#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$PATH:/home/sn-387116/.nvm/versions/node/v24.17.0/bin"

echo "=== [Real Valor] Iniciando Banco e Cache Docker ==="
cd "$DIR"
docker compose up -d postgres redis

echo "Aguardando PostgreSQL e Redis estarem saudáveis..."
until docker exec real_valor_postgres pg_isready -U real_valor -d real_valor_db > /dev/null 2>&1; do
  sleep 1
done

echo "=== [Real Valor] Iniciando Medusa Backend na porta 9000 ==="
cd "$DIR/backend"
if [ ! -f /tmp/medusa-backend.pid ] || ! kill -0 $(cat /tmp/medusa-backend.pid) 2>/dev/null; then
  nohup corepack yarn dev > /tmp/medusa-backend.log 2>&1 &
  echo $! > /tmp/medusa-backend.pid
  echo "Backend iniciado (PID $(cat /tmp/medusa-backend.pid))"
else
  echo "Backend já está em execução (PID $(cat /tmp/medusa-backend.pid))"
fi

echo "=== [Real Valor] Iniciando Storefront Next.js na porta 8000 ==="
cd "$DIR/frontend"
if [ ! -f /tmp/frontend-dev.pid ] || ! kill -0 $(cat /tmp/frontend-dev.pid) 2>/dev/null; then
  nohup corepack yarn dev > /tmp/frontend-dev.log 2>&1 &
  echo $! > /tmp/frontend-dev.pid
  echo "Frontend iniciado (PID $(cat /tmp/frontend-dev.pid))"
else
  echo "Frontend já está em execução (PID $(cat /tmp/frontend-dev.pid))"
fi

echo ""
echo "=========================================================="
echo " Real Valor - Loja de Moda Feminina Online!"
echo " • Loja Storefront (Next.js): http://localhost:8000"
echo " • Painel Admin Medusa v2:   http://localhost:9000/app"
echo "   - Usuário: admin@realvalor.com.br"
echo "   - Senha:   admin123456"
echo " • Catálogo de Roupas:      http://localhost:8000/br/store"
echo "=========================================================="
