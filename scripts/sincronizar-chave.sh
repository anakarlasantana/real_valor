#!/usr/bin/env bash
#
# Sincroniza a publishable key do BANCO para o `.env`.
# =============================================================================
# O token de uma base nova e' aleatorio: quem sabe qual e' o certo e' o banco.
# Ate aqui o seed so' IMPRIMIA a chave e alguem colava no `.env` — e um `.env`
# com a chave de um banco antigo derruba a loja inteira com
# `A valid publishable key is required to proceed with the request` (500 em
# toda pagina), sem nenhuma mensagem apontar para a chave.
#
# Chamado pelo `make seed`, depois do seed e antes de recriar o storefront.
# Idempotente: se o `.env` ja' tem a chave do banco, nao escreve nada.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENVF="$ROOT/.env"

[ -f "$ENVF" ] || exit 0

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33maviso\033[0m %s\n' "$1"; }

# O `.env` e' editado NO LUGAR (a ordem das chaves e' documentacao).
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

USUARIO="$(env_get POSTGRES_USER)"
USUARIO="${USUARIO:-real_valor}"
BANCO="$(env_get POSTGRES_DB)"
BANCO="${BANCO:-real_valor_db}"

CHAVE="$(docker compose exec -T postgres \
  psql -U "$USUARIO" -d "$BANCO" -tAc \
  "select token from api_key where type = 'publishable' order by created_at limit 1" \
  2>/dev/null | tr -d '\r' | head -1)"

if [ -z "$CHAVE" ]; then
  warn "o banco nao tem publishable key — rode 'make seed' primeiro"
  exit 0
fi

ATUAL="$(env_get NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY)"

if [ "$ATUAL" = "$CHAVE" ]; then
  ok "chave do .env ja e' a do banco"
  exit 0
fi

env_set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY "$CHAVE"
ok "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY sincronizada com o banco"
