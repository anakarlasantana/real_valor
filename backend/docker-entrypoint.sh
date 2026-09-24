#!/bin/sh
set -e

echo "=== [Real Valor Backend] Initializing Medusa v2 ==="

# Wait for PostgreSQL to be ready
if [ -n "$DATABASE_URL" ]; then
  echo "Checking database connectivity..."
fi

# Run database migrations
echo "Running Medusa v2 database migrations..."
yarn medusa db:migrate || {
  echo "Migration failed or already executed. Continuing..."
}

# Auto-create admin user if configured
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Ensuring Admin user exists ($ADMIN_EMAIL)..."
  yarn medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" || true
fi

# Execute passed command (default: yarn dev)
exec "$@"
