#!/bin/sh
# =============================================================================
# Real Valor — Backend (Medusa v2) — entrypoint do container
# =============================================================================
# Responsabilidades:
#   1. Aguardar o Postgres ACEITAR CONEXOES (nao apenas "existir no DNS")
#   2. Rodar as migrations (controlado por RUN_MIGRATIONS)
#   3. Criar/atualizar o usuario admin de forma IDEMPOTENTE
#   4. Entregar o controle ao comando do container (yarn start / yarn dev)
#
# Diferente da versao anterior, este script FALHA explicitamente quando o banco
# nao responde, em vez de seguir em frente e quebrar depois de forma obscura.
# =============================================================================
set -eu

log() { echo "[backend] $*"; }

# -----------------------------------------------------------------------------
# 1. Espera real pelo Postgres
# -----------------------------------------------------------------------------
# `pg_isready` do cliente psql valida que o servidor aceita conexoes. Apenas
# resolver o DNS do host ("postgres") nao garante que o banco esta pronto para
# receber queries — por isso o retry com timeout.
wait_for_postgres() {
  if [ -z "${DATABASE_URL:-}" ]; then
    log "DATABASE_URL nao definida — pulando a espera pelo banco."
    return 0
  fi

  # Extrai host/porta/usuario da DATABASE_URL sem depender de ferramentas
  # externas: postgres://user:pass@host:port/db
  _rest="${DATABASE_URL#*://}"      # user:pass@host:port/db
  _auth="${_rest%%@*}"              # user:pass
  _hostpart="${_rest#*@}"           # host:port/db
  _host="${_hostpart%%:*}"          # host
  _portpart="${_hostpart#*:}"       # port/db
  _port="${_portpart%%/*}"          # port
  _user="${_auth%%:*}"              # user

  [ -n "$_port" ] && [ "$_port" != "$_hostpart" ] || _port=5432

  log "Aguardando o Postgres em ${_host}:${_port}..."

  _attempt=1
  _max_attempts="${DB_WAIT_ATTEMPTS:-60}"

  while [ "$_attempt" -le "$_max_attempts" ]; do
    if pg_isready -h "$_host" -p "$_port" -U "$_user" -q 2>/dev/null; then
      log "Postgres pronto (tentativa ${_attempt})."
      return 0
    fi
    log "Postgres indisponivel — tentativa ${_attempt}/${_max_attempts}..."
    _attempt=$((_attempt + 1))
    sleep 2
  done

  log "ERRO: Postgres nao respondeu apos $((_max_attempts * 2))s."
  return 1
}

# -----------------------------------------------------------------------------
# 2. Migrations
# -----------------------------------------------------------------------------
run_migrations() {
  if [ "${RUN_MIGRATIONS:-1}" != "1" ]; then
    log "RUN_MIGRATIONS != 1 — pulando migrations (defina 1 para executa-las)."
    return 0
  fi

  log "Rodando migrations do Medusa v2..."
  if ! yarn medusa db:migrate; then
    log "ERRO: as migrations falharam. Abortando para evitar subir com o schema inconsistente."
    return 1
  fi
  log "Migrations concluidas."
}

# -----------------------------------------------------------------------------
# 3. Usuario admin (idempotente)
# -----------------------------------------------------------------------------
ensure_admin_user() {
  if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
    log "ADMIN_EMAIL/ADMIN_PASSWORD nao definidos — pulando a criacao do admin."
    return 0
  fi

  log "Garantindo o usuario admin ${ADMIN_EMAIL}..."
  # Se o usuario ja existe, o Medusa retorna erro — consideramos sucesso.
  if yarn medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" 2>&1; then
    log "Usuario admin verificado/criado."
  else
    log "Usuario admin ja existente (ou criacao nao aplicavel). Prosseguindo."
  fi
}

# -----------------------------------------------------------------------------
# Execucao
# -----------------------------------------------------------------------------
main() {
  log "=== Real Valor Backend — inicializando (NODE_ENV=${NODE_ENV:-development}) ==="

  wait_for_postgres
  run_migrations
  ensure_admin_user

  log "Iniciando o servidor: $*"
  exec "$@"
}

main "$@"

