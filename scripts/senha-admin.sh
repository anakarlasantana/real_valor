#!/usr/bin/env bash
#
# Troca a senha do admin do painel — no Medusa, e grava a nova no `.env`.
# =============================================================================
# POR QUE ISTO EXISTE
#
# `ADMIN_PASSWORD` no `.env` NAO e' a senha do admin: e' o valor com que
# `backend/docker-entrypoint.sh` CRIA o primeiro usuario — e ele trata "usuario
# ja' existe" como sucesso. Depois disso, editar o `.env` e recriar o backend
# nao muda login nenhum, e a impressao e' a pior possivel: o `.env` mostra uma
# senha nova enquanto o painel continua aceitando a antiga. Ver
# `docs/real-valor/11-ambiente-local.md` §11.6.2.
#
# QUEM TROCA E' O MEDUSA
#
# O caminho e' `authService.updateProvider("emailpass", { entity_id, password })`
# — o mesmo que qualquer porta de entrada do Medusa usa —, chamado DENTRO do
# container do backend por `medusa exec`. Nada aqui calcula hash: quem hasheia
# (scrypt, provider `emailpass`) e grava e' o proprio Medusa, e a senha nova
# passa a valer pelo mesmo caminho da antiga.
#
# POR QUE NAO PELA ROTA HTTP. `POST /auth/user/emailpass/update` existe, mas o
# `validateToken` dela (`api/auth/utils/validate-token.js`, medido) so' aceita
# token do fluxo de reset — `purpose: "reset"` e um `jti` de uso unico, consumido
# no proprio middleware —, e esse token sai por email, que esta stack nao envia.
# Um token de sessao (o do login normal) e' recusado com **401 "Invalid token"**,
# mesmo valendo em `/admin/*`. O fluxo HTTP fica para quando houver provedor de
# email; aqui vale o caminho de codigo, que e' o mesmo.
#
# O `.env` so' e' tocado DEPOIS de o login com a senha nova responder 200 — e o
# script confere tambem que a antiga deixou de valer. Se qualquer um dos dois
# testes falhar, o `.env` fica como estava e o script sai 1.
#
# Uso:
#   make admin-password                        -> sorteia e imprime uma senha forte
#   make admin-password NOVA='a senha nova'
#   ATUAL='a antiga' scripts/senha-admin.sh 'a nova'
#
# Variaveis:
#   NOVA/$1    a senha nova (sem `"` e sem `\`: ela vai no corpo JSON)
#   ATUAL      a senha atual (default: `ADMIN_PASSWORD` do `.env`)
#   EMAIL      o email do admin (default: `ADMIN_EMAIL` do `.env`)
#   BACKEND    onde o Medusa responde (default `http://localhost:9000`). Apontar
#              para o endereco publico (`https://<tunel>/painel-api`) confere, de
#              quebra, que o painel publicado aceita a senha nova.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENVF="$ROOT/.env"

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info() { printf '  \033[36m-\033[0m     %s\n' "$1"; }
bad()  { printf '  \033[31mFALHA\033[0m %s\n' "$1" >&2; }

# As duas funcoes de `scripts/tunnel.sh`: o `.env` e' editado NO LUGAR (a ordem
# das chaves e' documentacao), e uma chave ausente entra no fim do arquivo.
env_get() { sed -n "s/^$1=//p" "$ENVF" 2>/dev/null | head -1 | tr -d '"'\''\r'; }

env_set() {
  local nome="$1" valor="$2"

  if grep -q "^${nome}=" "$ENVF" 2>/dev/null; then
    awk -v n="$nome" -v v="$valor" \
      'index($0, n "=") == 1 { print n "=" v; next } { print }' "$ENVF" > "$ENVF.tmp"
    mv "$ENVF.tmp" "$ENVF"
  else
    printf '%s=%s\n' "$nome" "$valor" >> "$ENVF"
  fi
}

# -----------------------------------------------------------------------------
# Os valores
# -----------------------------------------------------------------------------
NOVA="${1:-${NOVA:-}}"
ATUAL="${ATUAL:-$(env_get ADMIN_PASSWORD)}"
EMAIL="${EMAIL:-$(env_get ADMIN_EMAIL)}"
BACKEND="${BACKEND:-http://localhost:9000}"

if [ -z "$EMAIL" ]; then
  bad "ADMIN_EMAIL esta' vazio no .env — sem email nao ha usuario para trocar a senha"
  exit 1
fi

if [ -z "$ATUAL" ]; then
  bad "sem senha atual: preencha ADMIN_PASSWORD no .env, ou passe ATUAL='...'"
  exit 1
fi

if [ -z "$NOVA" ]; then
  # hex: 32 caracteres, sempre seguros em JSON, em `curl -d` e em shell.
  NOVA="$(openssl rand -hex 16)"
  info "senha nova sorteada (guarde agora): $NOVA"
fi

case "$NOVA" in
  *[![:graph:]]*)
    bad 'a senha nova tem espaco ou caractere de controle (use algo imprimivel, sem espacos)'
    exit 1
    ;;
esac

# -----------------------------------------------------------------------------
# Login com a senha ATUAL
# -----------------------------------------------------------------------------
# Devolve o corpo cru: o `token` quando aceita, `{"message":...}` quando recusa.
login() {
  curl -s --max-time 20 -X POST "$BACKEND/auth/user/emailpass" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$1\"}"
}

token_de() {
  grep -o '"token":"[^"]*"' | head -1 | sed 's/.*:"//; s/"$//'
}

TOKEN="$(login "$ATUAL" | token_de)"

if [ -z "$TOKEN" ]; then
  bad "o login com a senha atual falhou em $BACKEND (a senha do .env esta' velha?)"
  printf '        %s\n' "passe a senha que funciona hoje: ATUAL='...' scripts/senha-admin.sh"
  exit 1
fi

ok "login com a senha atual respondeu token"

# -----------------------------------------------------------------------------
# A troca — dentro do container, pelo caminho de codigo do Medusa
# -----------------------------------------------------------------------------
# O mesmo `docker compose` do Makefile: com PROD=1, so' o arquivo base (o
# override e' o que liga o estagio `dev`).
compose() {
  if [ "${PROD:-0}" = "1" ]; then
    docker compose -f docker-compose.yml "$@"
  else
    docker compose "$@"
  fi
}

# O arquivo vive DENTRO do container (o Compose monta arquivos avulsos do
# backend, nao a pasta): ele entra por stdin, roda e some. O `-e` entrega o email
# e a senha como variavel de ambiente, sem passar por `sh -c` — nenhuma aspa,
# nenhum `$`, nenhum espaco precisa de escape.
ARQUIVO=".rv-senha-admin.mjs"

ler_stdin() {
  cat <<'FIM'
export default async function trocarSenha({ container }) {
  const { Modules } = await import("@medusajs/framework/utils")

  const email = process.env.RV_EMAIL
  const senha = process.env.RV_NOVA

  const res = await container
    .resolve(Modules.AUTH)
    .updateProvider("emailpass", { entity_id: email, password: senha })

  if (!res?.success) {
    console.error("FALHA:", res?.error ?? res)
    process.exit(1)
  }

  console.log("SENHA GRAVADA")
}
FIM
}

if ! ler_stdin | compose exec -T backend sh -c "cat > /app/backend/$ARQUIVO"; then
  bad "nao consegui escrever o script dentro do backend (o container esta' no ar?)"
  exit 1
fi

SAIDA="$(compose exec -T -e RV_EMAIL="$EMAIL" -e RV_NOVA="$NOVA" \
  backend sh -c "yarn medusa exec $ARQUIVO" 2>&1)"
CODIGO=$?

compose exec -T backend rm -f "/app/backend/$ARQUIVO" >/dev/null 2>&1

if [ "$CODIGO" != "0" ] || ! printf '%s' "$SAIDA" | grep -q 'SENHA GRAVADA'; then
  bad "a troca falhou dentro do backend:"
  printf '%s\n' "$SAIDA" | tail -6 | sed 's/^/        /'
  printf '        %s\n' "o .env NAO foi tocado: a senha do painel continua a mesma"
  exit 1
fi

ok "o Medusa gravou a senha nova de $EMAIL"

# -----------------------------------------------------------------------------
# A prova: a nova vale, a antiga nao
# -----------------------------------------------------------------------------
if [ -z "$(login "$NOVA" | token_de)" ]; then
  bad "o login com a senha NOVA falhou — a troca nao valeu, e o .env fica como estava"
  exit 1
fi

ok "login com a senha nova: aceito"

if [ -n "$(login "$ATUAL" | token_de)" ]; then
  bad "o login com a senha ANTIGA continua sendo aceito — a troca nao valeu"
  printf '        %s\n' "o .env fica como estava; se a senha antiga mudou de verdade, sete ATUAL"
  exit 1
fi

ok "login com a senha antiga: recusado"

env_set ADMIN_PASSWORD "$NOVA"
ok "ADMIN_PASSWORD atualizado no .env"

echo
info "guarde a senha nova: ela nao fica em nenhum outro lugar legivel do projeto"
printf '        %s\n' "o valor no .env e' o que o entrypoint usa para CRIAR o admin; quem decide o login e' o Medusa"
