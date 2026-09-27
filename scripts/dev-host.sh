#!/usr/bin/env bash
# =============================================================================
# Real Valor — modo HOST (sem build de imagem)
# =============================================================================
# Sobe Postgres e Redis em container e roda Medusa e Next DIRETO no host, com os
# `node_modules` ja instalados de `backend/` e `frontend/`.
#
# Por que existe: `make build` exige daemon Docker ativo e leva minutos; este
# modo serve o ciclo de edicao (e a validacao automatica do repositorio) sem
# esperar build. A stack canonica continua sendo o Compose (`make up`).
#
#   scripts/dev-host.sh up        # containers + migra + semeia + inicia os servidores
#   scripts/dev-host.sh down      # para os servidores (containers continuam de pe)
#   scripts/dev-host.sh status    # PID + saude de cada servidor
#   scripts/dev-host.sh logs backend|frontend
#
# Servicos (mesmas portas do Compose, independentes das outras stacks da maquina):
#   Postgres 127.0.0.1:5438   Redis 127.0.0.1:6381   API/CRM :9000   Loja :8000
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.run"
PUB="$(sed -n 's/^POSTGRES_USER=//p' "$ROOT/.env" 2>/dev/null | head -1)"; PUB="${PUB:-real_valor}"
PGDB="$(sed -n 's/^POSTGRES_DB=//p' "$ROOT/.env" 2>/dev/null | head -1)"; PGDB="${PGDB:-real_valor_db}"
REVALIDATE_SECRET="$(sed -n 's/^REVALIDATE_SECRET=//p' "$ROOT/.env" 2>/dev/null | head -1)"

mkdir -p "$RUN"

# ---------------------------------------------------------------------------
# Docker: escolhe um socket que RESPONDA. O contexto padrao pode apontar para
# um Docker Desktop parado; o daemon rootful costuma estar em /var/run/docker.sock.
# ---------------------------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  for sock in /var/run/docker.sock "$HOME/.docker/desktop/docker.sock"; do
    if [ -S "$sock" ] && DOCKER_HOST="unix://$sock" docker info >/dev/null 2>&1; then
      export DOCKER_HOST="unix://$sock"
      break
    fi
  done
fi
compose() { docker compose "$@"; }

psql_q() { # psql_q <sql>  -> valor cru
  docker exec real_valor_postgres psql -U "$PUB" -d "$PGDB" -tA -c "$1" 2>/dev/null | tr -d '\r'
}

wait_healthy() {
  for _ in $(seq 1 30); do
    local st
    st="$(docker inspect -f '{{.State.Health.Status}}' real_valor_postgres 2>/dev/null || echo none)"
    [ "$st" = "healthy" ] && return 0
    sleep 2
  done
  echo "AVISO: real_valor_postgres nao ficou healthy a tempo." >&2
}

env_file_frontend() {
  local file="$ROOT/frontend/.env.local"
  local key
  key="$(psql_q "select token from api_key where type='publishable' order by created_at limit 1")"
  key="${key:-pk_test}"
  cat > "$file" <<EOF
# GERADO por scripts/dev-host.sh — modo host (nao versionado, ver .gitignore).
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$key
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_REGION=br
NEXT_PUBLIC_STRIPE_KEY=
REVALIDATE_SECRET=${REVALIDATE_SECRET:-troque_este_segredo}
EOF
  echo "  frontend/.env.local atualizado (publishable key: ${key:0:12}...)"
}


start_bg() { # start_bg <nome> <cmd>
  local name="$1" cmd="$2"
  stop_one "$name"
  setsid nohup bash -c "$cmd" > "$RUN/$name.log" 2>&1 < /dev/null &
  echo $! > "$RUN/$name.pid"
  echo "  $name iniciado (pid $(cat "$RUN/$name.pid")) -> .run/$name.log"
}

stop_one() { # stop_one <nome>
  local name="$1" pid
  [ -f "$RUN/$name.pid" ] || return 0
  pid="$(cat "$RUN/$name.pid")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$RUN/$name.pid"
}

health() {
  local code
  printf '  backend  :9000         '
  if curl -fsS -m 5 http://localhost:9000/health >/dev/null 2>&1; then echo "OK"; else echo "INDISPONIVEL"; fi
  printf '  loja     :8000         '
  code="$(curl -o /dev/null -s -m 15 -w '%{http_code}' -L http://localhost:8000/br || echo 000)"
  echo "HTTP $code"
  printf '  painel   :9000/painel  '
  code="$(curl -o /dev/null -s -m 15 -w '%{http_code}' -L http://localhost:9000/painel || echo 000)"
  echo "HTTP $code"
}

case "${1:-}" in
  up)
    echo "== containers (postgres/redis) =="
    compose up -d postgres redis
    wait_healthy
    echo "== migracoes Medusa =="
    ( cd "$ROOT/backend" && ./node_modules/.bin/medusa db:migrate 2>&1 | tail -3 )
    echo "== usuario admin (idempotente) =="
    ADMIN_EMAIL="$(sed -n 's/^ADMIN_EMAIL=//p' "$ROOT/.env" 2>/dev/null | head -1)"
    ADMIN_PASSWORD="$(sed -n 's/^ADMIN_PASSWORD=//p' "$ROOT/.env" 2>/dev/null | head -1)"
    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
      # Mesma regra do `backend/docker-entrypoint.sh`: usuario existente faz o
      # comando sair com erro, e isso conta como sucesso (a senha ja gravada
      # nao e sobrescrita — ver "Credenciais" no README). O log fica em
      # `.run/admin-user.log` porque, sem ele, "ja existe" e "o banco nao
      # respondeu" imprimiriam a mesma linha.
      admin_log="$RUN/admin-user.log"
      if ( cd "$ROOT/backend" && ./node_modules/.bin/medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" 2>&1 | tail -40 > "$admin_log" ); then
        echo "  admin criado: $ADMIN_EMAIL"
      elif grep -qi 'already exists' "$admin_log"; then
        echo "  admin ja existente: $ADMIN_EMAIL"
      else
        echo "  AVISO: nao foi possivel criar/verificar o admin — ver .run/admin-user.log" >&2
      fi
    else
      echo "  ADMIN_EMAIL/ADMIN_PASSWORD nao definidos — pulando"
    fi
    echo "== seed (so quando vazio) =="
    if [ "$(psql_q 'select count(*) from product')" = "0" ]; then
      ( cd "$ROOT/backend" && ./node_modules/.bin/medusa exec ./src/scripts/seed.ts 2>&1 | tail -2 )
    else
      echo "  catalogo ja semeado — pulando"
    fi
    ( cd "$ROOT/backend" && ./node_modules/.bin/medusa exec ./src/scripts/seed-content.ts 2>&1 | tail -1 )
    echo "== storefront/env =="
    env_file_frontend
    echo "== servidores =="
    start_bg backend "cd '$ROOT/backend' && exec ./node_modules/.bin/medusa develop"
    start_bg frontend "cd '$ROOT/frontend' && exec ./node_modules/.bin/next dev --turbopack -p 8000"
    echo "   aguardando... (o admin do Medusa compila o Vite na primeira subida)"
    for _ in $(seq 1 14); do
      sleep 2
      curl -fsS -m 3 http://localhost:9000/health >/dev/null 2>&1 && break
    done
    echo "== saude =="
    health
    echo "== logs =="
    echo "  tail -f .run/backend.log .run/frontend.log   (ou: make host-logs)"
    ;;
  down)
    stop_one frontend; stop_one backend
    echo "servidores parados (containers de pe; 'make down' remove tudo)"
    ;;
  status)
    for n in backend frontend; do
      pid="$(cat "$RUN/$n.pid" 2>/dev/null || echo -)"
      if [ "$pid" != "-" ] && kill -0 "$pid" 2>/dev/null; then st="rodando"; else st="parado"; fi
      printf '%-9s pid=%-8s %s\n' "$n" "$pid" "$st"
    done
    health
    ;;
  logs)
    tail -n 40 -f "$RUN/${2:-backend}.log"
    ;;
  *)
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
