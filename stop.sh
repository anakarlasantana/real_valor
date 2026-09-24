#!/bin/bash
echo "Parando Frontend..."
if [ -f /tmp/frontend-dev.pid ]; then
  kill -9 $(cat /tmp/frontend-dev.pid) 2>/dev/null || true
  rm -f /tmp/frontend-dev.pid
fi

echo "Parando Backend..."
if [ -f /tmp/medusa-backend.pid ]; then
  kill -9 $(cat /tmp/medusa-backend.pid) 2>/dev/null || true
  rm -f /tmp/medusa-backend.pid
fi

echo "Parando Containers Docker..."
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose down

echo "Aplicação finalizada com sucesso."
