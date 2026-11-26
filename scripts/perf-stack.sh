#!/usr/bin/env bash
# =============================================================================
# perf-stack.sh — a TERCEIRA stack: a loja como ela vai ao ar, para medir.
# =============================================================================
# Sobe postgres/redis/backend/frontend do estagio `runner` (standalone) no
# projeto `rv_perf`, com portas proprias (8200 loja, 9200 API). Nao e' modo de
# desenvolvimento: o `next dev` compila sob demanda e mediria o compilador.
#
# Uso: scripts/perf-stack.sh up | down | health | destroy
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PROJETO=rv_perf
CONTAINER_PG=rv_perf_pg
PORTA_BACKEND=9200
PORTA_LOJA=8200
USUARIO="$(sed -n 's/^POSTGRES_USER=//p' .env | head -1)"
USUARIO="${USUARIO:-real_valor}"
BANCO="$(sed -n 's/^POSTGRES_DB=//p' .env | head -1)"
BANCO="${BANCO:-real_valor_db}"

compose() {
  docker compose -p "$PROJETO" -f docker-compose.yml -f docker-compose.perf.yml "$@"
}

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info() { printf '  \033[36m-\033[0m     %s\n' "$1"; }
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
  printf '\n── stack de medicao (projeto %s, sem override de dev) ─────────\n' "$PROJETO"

  compose up -d postgres redis || return 1
  esperar "postgres aceitando conexao" \
    "docker exec ${CONTAINER_PG} pg_isready -U $USUARIO -d $BANCO" 30 || return 1

  compose run --rm -T -u root backend yarn medusa db:migrate > .run/perf-migrate.log 2>&1 \
    || { bad "migrations falharam — veja .run/perf-migrate.log"; return 1; }
  ok "migrations aplicadas"

  compose up -d backend || return 1
  esperar "backend /health em :$PORTA_BACKEND" \
    "curl -fsS http://localhost:$PORTA_BACKEND/health" 60 || return 1

  # A imagem `runner` compila os scripts para `.js` (o `builder` roda `tsc`):
  # `yarn seed` aponta para `./src/scripts/seed.ts` e nao existe la'. Medido em
  # 25/11/2026 — o estagio `dev` tem o `.ts`, producao tem o `.js`.
  compose exec -T -u root backend sh -c 'yarn medusa exec ./src/scripts/seed.js' > .run/perf-seed.log 2>&1 \
    || { bad "seed falhou — veja .run/perf-seed.log"; return 1; }
  ok "seed concluido"

  # O BUILD VEM DEPOIS DO SEED, de proposito: `NEXT_PUBLIC_*` e' INLINADO no
  # bundle (`docker-compose.yml:264`), e a chave publicavel so' existe depois do
  # seed. Construir antes grava `pk_test` no JavaScript e a loja responde 500
  # ("A valid publishable key is required") — medido em 25/11/2026.
  local chave
  chave="$(docker exec "${CONTAINER_PG}" psql -U "$USUARIO" -d "$BANCO" -tAc \
    "select token from api_key where type='publishable' order by created_at limit 1" \
    | tr -d ' \r\n')"
  [ -n "$chave" ] || { bad "a base do perf nao tem publishable key"; return 1; }

  info "build de producao do storefront (com a chave desta base)"
  # A chave vai por `--build-arg`, e NAO por variavel de ambiente: o Compose
  # interpola `${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}` do `.env`, e o `.env` tem a
  # chave da stack de DEV — ela vencia e o bundle saía com a chave de outra base
  # (500 "A valid publishable key is required", medido em 25/11/2026).
  compose build \
    --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="$chave" \
    --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL="http://localhost:$PORTA_BACKEND" \
    --build-arg NEXT_PUBLIC_BASE_URL="http://localhost:$PORTA_LOJA" \
    frontend > .run/perf-build.log 2>&1 \
    || { bad "build do frontend falhou — veja .run/perf-build.log"; return 1; }
  ok "imagem de producao do storefront construida"

  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="$chave" compose up -d --force-recreate frontend || return 1
  esperar "loja em http://localhost:$PORTA_LOJA/br" \
    "curl -fsS http://localhost:$PORTA_LOJA/br" 90 || return 1

  info "aquecendo as rotas (o ISR precisa do primeiro acesso)"
  for rota in /br /br/store /br/products/e2e-vestido-de-teste /br/cart /br/rastreio; do
    curl -s -o /dev/null --max-time 60 "http://localhost:$PORTA_LOJA$rota" || true
  done
  ok "loja aquecida"
}

derrubar() { compose down; }

destruir() {
  compose down -v
  ok "volumes do projeto $PROJETO apagados"
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
  health)  saude ;;
  *)       echo "uso: $0 up|down|destroy|health" >&2; exit 2 ;;
esac
