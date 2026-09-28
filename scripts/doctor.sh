#!/usr/bin/env bash
# Diagnostico do ambiente local. **Nao muda nada**: so le e diz o que esta
# errado e o comando que resolve.
#
# Existe porque os tres problemas que derrubam `make up` nao dizem na cara do
# erro: container velho com o nome ocupado, porta ja usada por outra coisa, e
# publishable key do `.env` diferente da do banco (a Store API responde 400 e a
# loja inteira cai com 500 — sem nenhuma pista de que a chave e' o problema).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mFALHA\033[0m %s\n' "$1"; printf '        %s\n' "$2"; fail=1; }
warn() { printf '  \033[33maviso\033[0m %s\n' "$1"; }

env_get() { sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | tr -d '"'"'"'\r'; }
port_get() { sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | tr -d '"'"'"'\r'; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0 || return 1; }
pg_q() { docker compose exec -T postgres psql -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)" -tAc "$1" 2>/dev/null | tr -d '\r'; }

PG_PORT="$(port_get POSTGRES_PORT)"; PG_PORT="${PG_PORT:-5439}"
RDS_PORT="$(port_get REDIS_PORT)"; RDS_PORT="${RDS_PORT:-6382}"

echo "Ambiente local (somente leitura)"
echo

if docker info >/dev/null 2>&1; then
  ok "Docker no ar"
else
  bad "Docker não responde" "suba o Docker Desktop (ou o daemon) e rode de novo"
fi

# 1. Containers do projeto parados: é o que faz o Compose recusar com
#    "container name is already in use".
parados="$(docker ps -a --filter 'name=real_valor' --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -vE 'Up ' | awk '{print $1}')"
if [ -n "$parados" ]; then
  bad "containers do projeto parados: $(echo "$parados" | tr '\n' ' ')" "docker compose down --remove-orphans && docker rm -f $(echo "$parados" | tr '\n' ' ')"
else
  ok "nenhum container do projeto ocupando nome"
fi

# 2. Portas: com a stack de pé, o bind tem que existir; com a stack fora, a
#    porta tem que estar livre.
stack_up="$(docker compose ps --status running --services 2>/dev/null | wc -l)"
for par in "$PG_PORT:Postgres" "$RDS_PORT:Redis"; do
  p="${par%%:*}"; nome="${par##*:}"
  if port_busy "$p"; then
    if [ "$stack_up" -gt 0 ]; then ok "$nome publicado em $p"
    else warn "$p ocupada por um processo que não é do Compose (o Postgres do sistema costuma ficar na 5438)" "veja quem é: ss -ltnp | grep $p"
    fi
  else
    if [ "$stack_up" -gt 0 ]; then bad "$nome sem porta $p" "a porta $p está ocupada por fora do Compose; mude POSTGRES_PORT/REDIS_PORT no .env"
    else ok "$p livre"
    fi
  fi
done
for p in 8000 9000; do
  if [ "$stack_up" -gt 0 ] && ! port_busy "$p"; then
    bad "porta $p sem serviço" "docker compose logs backend frontend"
  fi
done

# 3. A chave do .env tem que ser a do banco: e o 400 "A valid publishable key is
#    required" que derrubava a loja inteira.
if [ "$stack_up" -gt 0 ]; then
  chave_env="$(env_get NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY)"
  chave_db="$(pg_q "select token from api_key where type='publishable' limit 1")"
  if [ -z "$chave_db" ]; then
    bad "o banco não tem publishable key" "make seed (o seed imprime a chave)"
  elif [ "$chave_env" != "$chave_db" ]; then
    bad "a chave do .env não é a do banco (a loja cai com 500)" "copie a chave que o seed imprime: make seed"
  else
    ok "publishable key do .env = a do banco"
  fi

  # 4. Registro do schema: sem ele a API serve o bootstrap e o CRM edita o
  #    contrato em vez do registro.
  if [ "$(pg_q "select to_regclass('public.content_schema') is not null")" = "t" ]; then
    linhas="$(pg_q 'select count(*) from content_schema')"
    if [ "${linhas:-0}" -gt 0 ]; then ok "registro do schema gravado (${linhas} linha)"
    else warn "tabela existe, mas o registro não foi gravado" "make seed-schema"
    fi
  else
    warn "a tabela content_schema ainda não existe" "make migrate"
  fi
else
  warn "stack não está de pé: as checagens de chave e registro foram puladas" "make up"
fi

echo
if [ "$fail" -eq 0 ]; then echo "Tudo certo."; else echo "Tem coisa acima para resolver."; fi
exit "$fail"
