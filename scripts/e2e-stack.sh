#!/usr/bin/env bash
# =============================================================================
# e2e-stack.sh — a SEGUNDA stack (projeto `rv_e2e`), isolada da de dev.
# =============================================================================
# A jornada do Playwright cria produto, edita conteudo e faz pedido: isso nao
# pode acontecer na base que voce esta usando. Aqui os dados nascem e morrem no
# projeto `rv_e2e` (volumes e rede prefixados pelo `-p`).
#
# Uso: scripts/e2e-stack.sh up | down | health | destroy
#   up       sobe postgres/redis, migra, roda o seed, cria os fixtures ([e2e])
#            e sobe o storefront com a chave publicavel DESTA base
#   down     derruba os containers (preserva os volumes)
#   destroy  derruba e apaga os volumes do projeto rv_e2e
#   health   testa backend (:9100) e loja (:8100)
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PROJETO=rv_e2e
CONTAINER_PG=rv_e2e_pg
PORTA_BACKEND=9100
PORTA_LOJA=8100
USUARIO="$(sed -n 's/^POSTGRES_USER=//p' .env | head -1)"
USUARIO="${USUARIO:-real_valor}"
BANCO="$(sed -n 's/^POSTGRES_DB=//p' .env | head -1)"
BANCO="${BANCO:-real_valor_db}"

compose() {
  docker compose -p "$PROJETO" \
    -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.e2e.yml "$@"
}

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info() { printf '  \033[36m-\033[0m     %s\n' "$1"; }
warn() { printf '  \033[33maviso\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31mFALHA\033[0m %s\n' "$1" >&2; }

esperar() {
  local descricao="$1" comando="$2" tentativas="${3:-60}" i=1
  while [ "$i" -le "$tentativas" ]; do
    bash -c "$comando" >/dev/null 2>&1 && { ok "$descricao"; return 0; }
    sleep 2; i=$((i + 1))
  done
  bad "tempo esgotado esperando: $descricao"
  return 1
}

subir() {
  printf '\n── stack e2e (projeto %s) ──────────────────────────────────────\n' "$PROJETO"

  compose up -d postgres redis || return 1
  esperar "postgres aceitando conexao" \
    "docker exec ${CONTAINER_PG} pg_isready -U $USUARIO -d $BANCO" 30 || return 1

  # Migrations com `-u root` (o `/app/node_modules` e' do root): e' o mesmo
  # motivo do `make migrate`. Sem elas o backend sobe com o schema vazio.
  info "migrations (db:migrate, -u root)"
  compose run --rm -T -u root backend yarn medusa db:migrate > .run/e2e-migrate.log 2>&1 \
    || { bad "migrations falharam — veja .run/e2e-migrate.log"; return 1; }
  ok "migrations aplicadas"

  compose up -d backend || return 1
  esperar "backend /health em :$PORTA_BACKEND" \
    "curl -fsS http://localhost:$PORTA_BACKEND/health" 60 || return 1

  info "seed da loja (canal, regiao, frete, caixa, chave, vitrine, tema, contrato)"
  compose exec -T -u root backend sh -c 'yarn seed' > .run/e2e-seed.log 2>&1 \
    || { bad "seed falhou — veja .run/e2e-seed.log"; return 1; }
  ok "seed concluido"

  info "fixtures do e2e (peca [e2e] + envio de preco fixo)"
  compose exec -T -u root backend sh -c 'yarn e2e:fixtures' > .run/e2e-fixtures.log 2>&1 \
    || { bad "fixtures falharam — veja .run/e2e-fixtures.log"; return 1; }
  ok "fixtures criados"

  # A chave publicavel e' do BANCO DESTA stack (base nova = token novo).
  local chave
  chave="$(docker exec "${CONTAINER_PG}" psql -U "$USUARIO" -d "$BANCO" -tAc \
    "select token from api_key where type='publishable' order by created_at limit 1" \
    | tr -d '\r' | head -1)"

  if [ -z "$chave" ]; then
    bad "a base do e2e nao tem publishable key"
    return 1
  fi

  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="$chave" compose up -d frontend || return 1
  esperar "loja em http://localhost:$PORTA_LOJA/br" \
    "curl -fsS http://localhost:$PORTA_LOJA/br" 60 || return 1

  # O `next dev` compila a rota sob demanda, e a PRIMEIRA visita pode abortar a
  # navegacao do Playwright (net::ERR_ABORTED - RW-2026-003). Aquecer aqui e'
  # barato e tira a corrida de dentro do teste.
  info "aquecendo as rotas da jornada (next dev compila sob demanda)"
  for rota in "/br" "/br/store" "/br/products/e2e-vestido-de-teste"; do
    curl -s -o /dev/null --max-time 90 "http://localhost:$PORTA_LOJA$rota" || true
  done
  ok "rotas aquecidas"

  printf '\n'
  ok "loja:  http://localhost:$PORTA_LOJA/br"
  ok "painel: http://localhost:$PORTA_BACKEND/painel"
  printf '\n'
}

derrubar() {
  compose down --remove-orphans
}

destruir() {
  warn "isto apaga os VOLUMES do projeto $PROJETO (dados de teste)"
  compose down -v --remove-orphans
}

aquecer() {
  for rota in "/br" "/br/store" "/br/products/e2e-vestido-de-teste" "/br/rastreio" "/br/cart"; do
    curl -s -o /dev/null --max-time 90 "http://localhost:$PORTA_LOJA$rota" || true
  done
}

saude() {
  printf '  backend :%s  ' "$PORTA_BACKEND"
  curl -fsS "http://localhost:$PORTA_BACKEND/health" >/dev/null && echo "OK" || echo "INDISPONIVEL"
  printf '  loja    :%s  ' "$PORTA_LOJA"
  curl -fsS "http://localhost:$PORTA_LOJA/br" >/dev/null && echo "OK" || echo "INDISPONIVEL"
}

case "${1:-}" in
  up)      subir ;;
  down)    derrubar ;;
  destroy) destruir ;;
  warm)    aquecer ;;
  health)  saude ;;
  *)       echo "uso: $0 up|down|destroy|warm|health" >&2; exit 2 ;;
esac
