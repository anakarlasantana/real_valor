#!/usr/bin/env bash
# Diagnostico do ambiente local. **Nao muda nada**: so le e diz o que esta
# errado e o comando que resolve.
#
# Existe porque os problemas que derrubam `make up` nao dizem na cara do erro:
# container velho com o nome ocupado, porta ja usada por outra coisa, publishable
# key do `.env` diferente da do banco (a Store API responde 400 e a loja inteira
# cai com 500 — sem pista de que a chave e' o problema) e o bind do CRM preso a um
# diretorio orfao (o painel sobe sem o menu "Conteudo da vitrine" e sem erro
# nenhum; ver o check 6).
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

  # 4. Registro do contrato: sem ele a API serve o bootstrap e o CRM edita o
  #    contrato em vez do registro.
  if [ "$(pg_q "select to_regclass('public.content_contract') is not null")" = "t" ]; then
    linhas="$(pg_q 'select count(*) from content_contract')"
    if [ "${linhas:-0}" -gt 0 ]; then ok "registro do contrato gravado (${linhas} linha)"
    else warn "tabela existe, mas o registro não foi gravado" "make seed-schema"
    fi
  else
    warn "a tabela content_contract ainda não existe" "make migrate"
  fi

  # 5. Ordem das seções: `position` repetida **na mesma superfície** é ordem
  #    indefinida na vitrine (a loja ordena por ela), e o banco não proíbe — não
  #    há índice único, de propósito, porque o Medusa não usa um para coluna de
  #    ordenação (o `image.rank` dele é índice comum). A numeração é de cada
  #    superfície: a home numera de 1 a 10 (o bloco ancorado em 1, 2, 3, 4 e 10, e
  #    as seções ordenáveis em 5 a 9), e o tema numera de 10 em 10. Comparar as
  #    duas juntas acusava a casa 10 do rodapé contra a estação 10 do tema — dois
  #    números que nunca disputam nada, porque a loja lê uma superfície por
  #    requisição. O CRM renumera superfície por superfície e nunca repete; quem
  #    repete é edição à mão, e o sintoma que aparece é "a home muda de ordem
  #    sozinha", que não aponta para o banco. Por isso a checagem é aqui, na
  #    leitura, e não numa constraint.
  if [ "$(pg_q "select to_regclass('public.content_section') is not null")" = "t" ]; then
    duplicadas="$(pg_q "select string_agg(casa, ', ') from (select surface || ':' || position::text as casa from content_section where deleted_at is null group by surface, position having count(*) > 1) d")"
    if [ -z "$duplicadas" ]; then
      ok "nenhuma seção com position repetida na mesma superfície"
    else
      bad "posição repetida na mesma superfície de content_section: $duplicadas" "abra Conteúdo da vitrine e use 'Salvar ordem' na superfície citada (a home renumera de 1 a 10; o tema, de 10 em 10)"
    fi
  else
    warn "a tabela content_section ainda não existe" "make migrate"
  fi
  # 6. O CRM (a extensao do painel) tem que estar VISIVEL dentro do backend. O
  #    bind `./admin:/app/admin` do override de DEV pode ficar preso a um
  #    diretorio ORFAO: quando o container nasceu, `admin/` era outra coisa (o
  #    CRM morava em `backend/src/admin` ate a R7) e o Docker montou o inode
  #    daquele momento. Depois da mudanca o diretorio do host virou outro, e o
  #    container velho continuou vendo o antigo, VAZIO (medido: 4 entradas no
  #    host, `total 0` dentro do container; inode 26083381 x 26083369). O
  #    `medusa-config.ts` filtra as fontes que existem, entao o painel subia sem
  #    extensao nenhuma: o menu "Conteudo da vitrine" sumia e nenhum log acusava.
  #    Desde a R7.1 aquela config FALHA ALTO nesse caso (e' ela que derruba o
  #    backend em DEV -- este check existe para o diagnostico chegar antes, e
  #    para dizer que a causa e' do ambiente e nao do CRM).
  #    Em PROD nao ha fonte a montar: o painel vem do bundle compilado, e quem
  #    diz isso e' o `NODE_ENV=production` do Compose (o MESMO discriminador do
  #    guard da config). `restart` tambem remonta o bind (medido), mas quem pega
  #    imagem e configuracao novas e' o `make recreate`.
  if [ -n "$(docker compose ps -q backend 2>/dev/null)" ]; then
    if [ "$(docker compose exec -T backend printenv NODE_ENV 2>/dev/null | tr -d '\r')" = "production" ]; then
      ok "backend em modo producao: o painel vem do bundle compilado (nao ha fonte a montar)"
    elif docker compose exec -T backend test -d /app/admin/src/admin 2>/dev/null; then
      ok "CRM visivel dentro do backend (/app/admin/src/admin)"
    else
      bad "o CRM não está visível dentro do backend: o painel sobe sem 'Conteúdo da vitrine'" "docker compose up -d --force-recreate backend   (ou: make recreate SERVICE=backend)"
    fi
  fi
else
  warn "stack não está de pé: as checagens de chave e registro foram puladas" "make up"
fi

echo
if [ "$fail" -eq 0 ]; then echo "Tudo certo."; else echo "Tem coisa acima para resolver."; fi
exit "$fail"
