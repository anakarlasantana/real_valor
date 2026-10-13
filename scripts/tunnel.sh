#!/usr/bin/env bash
#
# Publica a loja E O PAINEL num ENDERECO UNICO e aponta o `.env` para ele.
# =============================================================================
# O QUE ISTO RESOLVE
#
# O Mercado Pago precisa de uma URL publica com HTTPS que termine em
# `/webhooks/mercadopago` (ver `MP_NOTIFICATION_URL`), e a cliente que paga
# precisa voltar para uma pagina que exista (ver `MP_BACK_URL`). Sem as duas, o
# pagamento e' aprovado, o dinheiro entra, e o pedido NAO NASCE — o desfecho que
# `alertaDaNotificacao` (`backend/src/modules/payment/mercadopago/credenciais.ts`)
# avisa em voz alta a cada boot.
#
# O `docs/real-valor/11-ambiente-local.md` §11.6 preve DOIS tuneis (backend e
# storefront) porque sao dois enderecos. O plano gratuito do ngrok da UM dominio
# reservado, e dois agentes no MESMO dominio nao coexistem: o ultimo a subir
# responde, o outro fica inalcancavel, e o webhook cai no servidor errado sem
# erro nenhum — foi exatamente o que aconteceu quando os dois subiram juntos.
#
# A saida e' um tunel so', para o STOREFRONT, com tres reescritas para o backend
# (`frontend/next.config.js`: `/webhooks/:path*`, `/painel` e `/painel-api` ->
# Medusa). O mesmo endereco passa a servir a pagina, a imagem (`/uploads`), o
# webhook e o painel:
#
#   https://<tunel>/br/pedido/confirmacao   a volta da cliente
#   https://<tunel>/webhooks/mercadopago    a notificacao do provedor
#   https://<tunel>/painel                  o painel do admin
#   https://<tunel>/painel-api/admin/...    a API que o painel chama
#
# **Nada de CORS nesse caminho.** O navegador so' fala com o Next (as chamadas
# de dados sao server actions em `frontend/src/lib/data/`), e o Next fala com o
# backend por `http://backend:9000`, dentro da rede do Compose. Publicar o
# backend direto no tunel obrigaria a abrir `STORE_CORS` e a servir a Store API
# para a internet inteira — sem necessidade, para o mesmo resultado.
#
# O PAINEL DO ADMIN VAI JUNTO. Ele e' servido pelo backend (`:9000/painel`,
# `admin.path` em `backend/medusa-config.ts`), e DUAS reescritas do storefront o
# trazem para o endereco publico (`frontend/next.config.js`): `/painel` entrega a
# pagina, `/painel-api/<caminho>` entrega tudo o que a pagina chama (`/admin`,
# `/auth`, `/cloud`).
#
# As duas sao necessarias, e a segunda e' o que faz o login funcionar de fora. O
# bundle do painel chama a API por um endereco ABSOLUTO, gravado no backend
# (`MEDUSA_BACKEND_URL` -> `__BACKEND_URL__`, `backend/medusa-config.ts`). Com o
# valor local, o navegador de quem esta' FORA posta em `http://localhost:9000` —
# o `localhost` DA MAQUINA DELE, onde nada responde — e o login morre em
# `ERR_FAILED`, sem mensagem, com a credencial certa. E' por isso que este script
# passa a gravar `MEDUSA_BACKEND_URL=https://<tunel>/painel-api`.
#
# ⚠️ Isto PUBLICA acesso administrativo: quem tiver o endereco alcanca o painel,
# e o login e' a unica porta. O script RECUSA publicar enquanto a senha for a de
# exemplo do `.env.example` (ver "ANTES DE PUBLICAR, A SENHA") e acrescenta o
# endereco a `ADMIN_CORS`/`AUTH_CORS`, mas quem troca a senha e'
# `make admin-password`.
#
# O Vite do painel tambem precisa aceitar o `Host` de quem chega — sem isso o
# painel responde 403 "Blocked request" no caminho do storefront (local E
# publico, porque quem proxeia e' o Next, sempre com o mesmo `Host` interno).
# Quem resolve e' `__MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS`, cujo default
# (`backend`) ja' vem do `docker-compose.yml`; este script acrescenta o host do
# tunel. Confira depois de publicar com `make health` e `make logs-admin`, e leia
# `docs/real-valor/11-ambiente-local.md` §11.6.2.
#
# O QUE ELE MUDA — E COMO DESFAZER
#
# Este script edita o `.env` (nao um overlay) e guarda os valores originais em
# `.run/tunnel.env.bak` na primeira subida. `make tunnel-stop` devolve os
# valores e reinicia backend e storefront. As chaves:
#
#   NEXT_PUBLIC_BASE_URL    o endereco publico do site
#   MP_NOTIFICATION_URL     https://<tunel>/webhooks/mercadopago
#   MP_BACK_URL             https://<tunel>/br/pedido/confirmacao
#   STORE_CORS/ADMIN_CORS/AUTH_CORS
#                           a origem publica entra na lista (nao e' preciso para
#                           o navegador; serve para um `curl`/painel nativo)
#   MEDUSA_BACKEND_URL      https://<tunel>/painel-api — o endereco que o BUNDLE
#                           do painel passa a usar para chamar a API (ver o bloco
#                           do painel); o backend e' recriado para reler
#   __MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS
#                           o host do tunel, que o Vite do painel precisa aceitar
#                           como `Host` — sem ele, 403 "Blocked request" no
#                           painel publicado
#
# ANTES DE PUBLICAR, A SENHA
#
# `ADMIN_PASSWORD` no `.env` NAO e' a senha do admin: e' o valor com que o
# `backend/docker-entrypoint.sh` CRIA o primeiro usuario, e ele trata "usuario
# ja' existe" como sucesso. Depois disso, editar o `.env` nao muda login nenhum
# — quem troca a senha de verdade e' o Medusa, e o caminho e':
#
#   make admin-password                      (sorteia uma senha forte)
#   make admin-password NOVA='a senha nova'
#
# Enquanto a senha for a de exemplo (`admin123456`, a do `.env.example`), este
# script NAO publica o painel — publicar com ela e' publicar a loja. Para
# publicar assim mesmo (ambiente descartavel): `make tunnel ACEITAR_SENHA_EXEMPLO=1`.
#
# Uso: scripts/tunnel.sh start|stop|status
#
# Variaveis (opcionais, do ambiente ou do `.env`):
#   TUNNEL_DOMAIN   dominio reservado do ngrok (ex.: algo.ngrok-free.dev). Sem
#                   ele, o ngrok sorteia um subdominio novo A CADA subida — o
#                   endereco ja gravado no provedor deixa de existir, e o
#                   `make tunnel` seguinte reescreve tudo. Com o plano gratuito
#                   ha UM dominio reservado; veja `ngrok config`/o painel.
#   TUNNEL_PORTA    porta local publicada (default 8000, o storefront).
#   PROD=1          usa `docker compose -f docker-compose.yml` (igual ao Makefile).
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN="$ROOT/.run"
LOG="$RUN/tunnel.log"
PID="$RUN/tunnel.pid"
BAK="$RUN/tunnel.env.bak"
ENVF="$ROOT/.env"
API="http://127.0.0.1:4040/api/tunnels"

CHAVES=(NEXT_PUBLIC_BASE_URL MP_NOTIFICATION_URL MP_BACK_URL STORE_CORS ADMIN_CORS AUTH_CORS MEDUSA_BACKEND_URL __MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS)

# A senha de exemplo do `.env.example`. Nao e' um segredo: e' um valor que existe
# em qualquer copia do repositorio, e por isso mesmo nao pode ir para um endereco
# publico (ver `senha_de_exemplo`, abaixo).
SENHA_EXEMPLO="admin123456"

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info() { printf '  \033[36m-\033[0m     %s\n' "$1"; }
warn() { printf '  \033[33maviso\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31mFALHA\033[0m %s\n' "$1" >&2; }

compose() {
  if [ "${PROD:-0}" = "1" ]; then
    docker compose -f docker-compose.yml "$@"
  else
    docker compose "$@"
  fi
}

env_get() { sed -n "s/^$1=//p" "$ENVF" 2>/dev/null | head -1 | tr -d '"'\''\r'; }

# Ordem de precedencia: ambiente -> `.env` -> default. O `.env` e' onde mora o
# dominio reservado, que nao muda de uma subida para a outra.
PORTA="${TUNNEL_PORTA:-$(env_get TUNNEL_PORTA)}"
PORTA="${PORTA:-8000}"
PAIS="${TUNNEL_PAIS:-$(env_get TUNNEL_PAIS)}"
PAIS="${PAIS:-br}"

# Troca o valor de uma chave NO LUGAR (a ordem do `.env` e' documentacao) e
# acrescenta a chave no fim quando ela ainda nao existe.
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

# Acrescenta um item a uma lista separada por virgula, sem duplicar.
env_add_csv() {
  local nome="$1" item="$2" atual

  atual="$(env_get "$nome")"

  case ",$atual," in
    *",$item,"*) return 0 ;;
  esac

  env_set "$nome" "${atual:+$atual,}$item"
}

# A senha que o painel usa e' a do exemplo do repositorio? O `.env` e' a unica
# fonte: `ADMIN_PASSWORD` e' o que o entrypoint do backend le' para criar o admin.
senha_de_exemplo() {
  [ "$(env_get ADMIN_PASSWORD)" = "$SENHA_EXEMPLO" ]
}

# -----------------------------------------------------------------------------
# O agente do ngrok
# -----------------------------------------------------------------------------
agente_vivo() { curl -s -o /dev/null --max-time 3 "$API" 2>/dev/null; }

url_do_agente() {
  curl -s --max-time 5 "$API" 2>/dev/null \
    | grep -o '"public_url":"https://[^"]*"' | head -1 | sed 's/.*:"//; s/"$//'
}

destino_do_agente() {
  curl -s --max-time 5 "$API" 2>/dev/null \
    | grep -o '"addr":"[^"]*"' | head -1 \
    | sed 's/.*:"//; s/"$//; s#^https\?://##'
}

# PIDs de processos que SAO o binario ngrok e publicam esta porta. O filtro por
# `ps -o comm=` existe porque `pgrep -f` casa tambem o shell que contem o padrao
# na propria linha de comando — e matar esse shell interrompe o proprio script.
pids_do_agente() {
  local porta="$1" pid

  for pid in $(pgrep -f 'ngrok' 2>/dev/null || true); do
    [ "$pid" = "$$" ] && continue
    [ "$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ')" = "ngrok" ] || continue
    ps -o args= -p "$pid" 2>/dev/null | grep -q " $porta\b" || continue
    printf '%s\n' "$pid"
  done
}

# Encerra SO' o agente que publica a porta pedida (default: a do storefront). Um
# `pkill ngrok` levaria junto o tunel de qualquer outra coisa rodando nesta
# maquina.
matar_agente() {
  local porta="${1:-$PORTA}" pids

  if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
    kill -TERM "$(cat "$PID")" 2>/dev/null
  fi

  pids="$(pids_do_agente "$porta")"
  if [ -n "$pids" ]; then
    kill -TERM $pids 2>/dev/null
  fi

  rm -f "$PID"

  for _ in $(seq 1 20); do
    agente_vivo || return 0
    sleep 0.3
  done

  pids="$(pids_do_agente "$porta")"
  if [ -n "$pids" ]; then
    kill -KILL $pids 2>/dev/null
  fi

  return 0
}

# -----------------------------------------------------------------------------
# O backup do `.env`
# -----------------------------------------------------------------------------
guardar() {
  [ -f "$BAK" ] && return 0

  mkdir -p "$RUN"
  : > "$BAK"

  for chave in "${CHAVES[@]}"; do
    printf '%s=%s\n' "$chave" "$(env_get "$chave")" >> "$BAK"
  done

  info "valores originais guardados em .run/tunnel.env.bak"
}

restaurar() {
  if [ ! -f "$BAK" ]; then
    warn "sem .run/tunnel.env.bak — o .env fica como esta"
    return 0
  fi

  while IFS= read -r linha; do
    case "$linha" in
      "" | "#"*) continue ;;
    esac
    env_set "${linha%%=*}" "${linha#*=}"
  done < "$BAK"

  # Uma chave que o backup NAO tem e' uma que ainda nao era controlada quando ele
  # foi feito (o script cresceu desde entao). Deixar como esta' significaria
  # terminar o `stop` com o painel apontando para um endereco que acabou de deixar
  # de existir — o mesmo defeito que o `stop` existe para desfazer. Entao ela
  # volta ao repouso, que e' o default do `docker-compose.yml`:
  # `MEDUSA_BACKEND_URL` local e `allowed hosts` so' com o host interno.
  # (Ao acrescentar uma chave nova a `CHAVES`, se ela tiver valor de repouso
  # proprio, e' aqui que ele entra.)
  for chave in "${CHAVES[@]}"; do
    grep -q "^${chave}=" "$BAK" && continue

    case "$chave" in
      MEDUSA_BACKEND_URL) env_set "$chave" "http://localhost:9000" ;;
      __MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS) env_set "$chave" "backend" ;;
    esac
  done

  rm -f "$BAK"
  ok "valores originais devolvidos ao .env"
}

# -----------------------------------------------------------------------------
# Sondas
# -----------------------------------------------------------------------------
# O cabecalho `ngrok-skip-browser-warning` pula a pagina de aviso do plano
# gratuito. Sem ele, um GET de navegador (Accept: text/html) recebe um HTML de
# interstitial com 200 e o corpo ERRADO — pior de diagnosticar do que um erro,
# porque parece que funcionou. Um POST de servidor a servidor (o do provedor)
# nao passa por essa pagina.
sonda_home() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    -H 'ngrok-skip-browser-warning: 1' "$1/$PAIS"
}

sonda_webhook() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
    -H 'ngrok-skip-browser-warning: 1' -H 'content-type: application/json' \
    -d '{"data":{"id":"0"}}' "$1/webhooks/mercadopago"
}

# A pagina do painel chega pelo endereco publico? E' o teste que separa "a
# reescrita esta valendo" (200) de "o middleware desviou para a vitrine" (307) e
# de "o Vite recusou o Host do tunel" (403).
sonda_painel() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    -H 'ngrok-skip-browser-warning: 1' "$1/painel"
}

# E a API do painel? O caminho e' o de uma chamada autenticada SEM sessao: 401
# prova que a requisicao chegou ao Medusa pela reescrita de `/painel-api` — nao
# que ela virou HTML de vitrine (307) nem que nao existe (404). Nao precisa de
# credencial nenhuma, e por isso o roteiro de teste nao carrega senha.
sonda_painel_api() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    -H 'ngrok-skip-browser-warning: 1' -H 'x-medusa-access-token: vazio' \
    "$1/painel-api/admin/users/me"
}

# `compose up -d` devolve o controle antes de o Next terminar de subir: sem esta
# espera, o teste abaixo reprova a loja que ainda estava compilando.
aguardar_loja() {
  local codigo

  for _ in $(seq 1 30); do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$PORTA/$PAIS" 2>/dev/null)"
    [ "$codigo" = "200" ] && return 0
    sleep 2
  done

  return 1
}

# A loja pode responder antes do backend: o `up -d` recria os dois e o Next sobe
# mais rapido. Sem esta segunda espera, o POST de teste batia no backend ainda
# desligado, o rewrite virava `ECONNREFUSED` e a verificacao acusava 500 — um
# falso negativo que parecia erro de assinatura.
aguardar_webhook() {
  local codigo

  for _ in $(seq 1 30); do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
      -X POST -H 'content-type: application/json' \
      -d '{}' "http://localhost:$PORTA/webhooks/mercadopago" 2>/dev/null)"

    case "$codigo" in
      200 | 400 | 401 | 403) return 0 ;;
    esac

    sleep 2
  done

  return 1
}

# O endereco publico serve as duas coisas que o pagamento precisa?
verificar() {
  local url="$1" home webhook painel api gravado

  home="$(sonda_home "$url")"
  webhook="$(sonda_webhook "$url")"
  painel="$(sonda_painel "$url")"
  api="$(sonda_painel_api "$url")"

  if [ "$home" = "200" ]; then
    ok "a loja responde em $url/$PAIS"
  else
    bad "a loja respondeu $home em $url/$PAIS (o storefront esta no ar?)"
  fi

  case "$webhook" in
    401)
      ok "o webhook responde pelo endereco publico (401 = sem assinatura, como deve ser)"
      ;;
    404)
      bad "o webhook respondeu 404 — a reescrita de /webhooks nao esta valendo"
      printf '        %s\n' "recrie o storefront para ele reler o next.config.js: make recreate SERVICE=frontend"
      ;;
    *)
      bad "o webhook respondeu $webhook (esperado 401)"
      ;;
  esac

  case "$painel" in
    200)
      ok "o painel responde em $url/painel"
      ;;
    403)
      bad "o painel respondeu 403 em $url/painel — o Vite recusou o Host do tunel"
      printf '        %s\n' "__MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS esta '$(env_get __MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS)'"
      printf '        %s\n' "recrie o backend para ele reler o .env: make recreate SERVICE=backend"
      ;;
    *)
      bad "o painel respondeu $painel em $url/painel (esperado 200)"
      ;;
  esac

  case "$api" in
    401)
      ok "a API do painel responde pelo endereco publico (401 = sem sessao, como deve ser)"
      ;;
    404)
      bad "a API do painel respondeu 404 — a reescrita de /painel-api nao esta valendo"
      printf '        %s\n' "recrie o storefront para ele reler o next.config.js: make recreate SERVICE=frontend"
      ;;
    *)
      bad "a API do painel respondeu $api (esperado 401)"
      ;;
  esac

  gravado="$(env_get MEDUSA_BACKEND_URL)"

  if [ "$gravado" = "$url/painel-api" ]; then
    ok "MEDUSA_BACKEND_URL (do painel) aponta para o endereco publico"
  else
    warn "MEDUSA_BACKEND_URL esta '$gravado' (esperado '$url/painel-api')"
  fi

  gravado="$(env_get MP_NOTIFICATION_URL)"

  if [ "$gravado" = "$url/webhooks/mercadopago" ]; then
    ok "MP_NOTIFICATION_URL aponta para o endereco publico"
  else
    warn "MP_NOTIFICATION_URL esta '$gravado' (esperado '$url/webhooks/mercadopago')"
  fi
}

# -----------------------------------------------------------------------------
# start
# -----------------------------------------------------------------------------
cmd_start() {
  local dominio atual url

  if ! command -v ngrok >/dev/null 2>&1; then
    bad "ngrok nao esta no PATH"
    printf '        %s\n' "instale em https://ngrok.com/download e rode 'ngrok config add-authtoken <token>'"
    return 1
  fi

  if ! compose ps --status running --services 2>/dev/null | grep -qx frontend; then
    bad "o storefront nao esta no ar — suba a stack antes ('make up')"
    return 1
  fi

  # O painel sai junto (ver o bloco "O PAINEL DO ADMIN VAI JUNTO" no cabecalho), e
  # a senha dele e' a unica porta. Antes de qualquer efeito — nenhuma chave foi
  # escrita ainda —, recuse publicar com a senha que esta' no .env.example.
  if senha_de_exemplo && [ "${ACEITAR_SENHA_EXEMPLO:-0}" != "1" ]; then
    bad "a senha do painel ainda e' a de exemplo do .env.example"
    printf '        %s\n' "publicar assim entrega o painel de administracao a quem tiver o endereco"
    printf '        %s\n' "troque a senha antes: make admin-password   (ver §11.6.2 do doc 11)"
    printf '        %s\n' "para publicar assim mesmo (ambiente descartavel): make tunnel ACEITAR_SENHA_EXEMPLO=1"
    return 1
  fi

  # O Compose da' precedencia ao ambiente do SHELL sobre o `.env` — e este script
  # acabou de gravar o `.env` esperando que os servicos o leiam. O caso do valor
  # EXPORTADO e VAZIO e' o mesmo que `make up`/`make recreate` tratam como erro,
  # com o mesmo script (`scripts/check-env-shadow.sh`); aqui ele vem ANTES de
  # qualquer escrita, porque nao ha o que publicar sem os valores chegando.
  if [ -x "$ROOT/scripts/check-env-shadow.sh" ] && ! "$ROOT/scripts/check-env-shadow.sh"; then
    bad "o shell tem variaveis VAZIAS sombreando o .env (a lista esta acima)"
    printf '        %s\n' "faca o 'unset' sugerido e rode 'make tunnel' de novo"
    return 1
  fi

  dominio="$(env_get TUNNEL_DOMAIN)"

  if agente_vivo; then
    atual="$(destino_do_agente)"

    case "$atual" in
      "localhost:$PORTA" | "127.0.0.1:$PORTA")
        info "ja' existe um agente em $atual — reaproveitado"
        ;;
      *)
        warn "havia um agente apontando para '$atual' — trocando pelo storefront (:$PORTA)"
        matar_agente "${atual##*:}"
        sleep 1

        if agente_vivo; then
          bad "nao consegui encerrar o agente em '$atual'"
          printf '        %s\n' "encerre-o a mao e rode de novo: pkill -f 'ngrok http ${atual##*:}'"
          printf '        %s\n' "seguir agora publicaria o lugar ERRADO no mesmo dominio"
          return 1
        fi
        ;;
    esac
  fi

  if agente_vivo; then
    url="$(url_do_agente)"
  else
    mkdir -p "$RUN"
    guardar
    : > "$LOG"

    if [ -n "$dominio" ]; then
      nohup ngrok http "$PORTA" --domain "$dominio" --log "$LOG" >/dev/null 2>&1 &
    else
      warn "TUNNEL_DOMAIN vazio — o ngrok sorteia um subdominio NOVO a cada subida"
      nohup ngrok http "$PORTA" --log "$LOG" >/dev/null 2>&1 &
    fi

    echo $! > "$PID"

    url=""
    for _ in $(seq 1 40); do
      url="$(url_do_agente)"
      [ -n "$url" ] && break
      sleep 0.5
    done

    if [ -z "$url" ]; then
      bad "o agente nao subiu — veja .run/tunnel.log"
      [ -f "$LOG" ] && tail -n 15 "$LOG"
      return 1
    fi

    ok "endereco publico: $url"
  fi

  if [ -z "$url" ]; then
    bad "nao consegui ler o endereco publico do agente"
    return 1
  fi

  # ---------------------------------------------------------------------------
  # O `.env`, ANTES de recriar: o backend sobe lendo estas chaves, e um backend
  # com a URL antiga mantem o aviso de boot apontando para o webhook.site — que
  # captura a notificacao e engole a venda.
  # ---------------------------------------------------------------------------
  env_set NEXT_PUBLIC_BASE_URL "$url"
  env_set MP_NOTIFICATION_URL "$url/webhooks/mercadopago"
  env_set MP_BACK_URL "$url/$PAIS/pedido/confirmacao"
  env_add_csv STORE_CORS "$url"
  env_add_csv ADMIN_CORS "$url"
  env_add_csv AUTH_CORS "$url"
  # O painel: o endereco ABSOLUTO que o bundle dele chama (`__BACKEND_URL__`) e o
  # `Host` que o Vite dele precisa aceitar. O host vai sem esquema — Vite compara
  # com o cabecalho `Host`, nao com origem.
  env_set MEDUSA_BACKEND_URL "$url/painel-api"
  # `backend` e' obrigatorio (a reescrita do Next chega ao Vite com
  # `Host: backend:9000`, medido — sem ele, 403 ate' em local); o host do tunel
  # entra junto para o navegador que alcancar o painel direto no backend (o
  # caminho de dois tuneis da §11.6).
  env_set __MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS "backend,${url#*//}"
  ok "MP_NOTIFICATION_URL = $url/webhooks/mercadopago"
  ok "MP_BACK_URL         = $url/$PAIS/pedido/confirmacao"
  ok "painel              = $url/painel"
  ok "API do painel       = $url/painel-api"

  # O outro caso e' a variavel exportada COM valor (e diferente do que gravamos
  # agora). Para o check oficial isso pode ser intencional
  # (`MP_ACCESS_TOKEN=... make up`), mas aqui e' sempre suspeito:
  # `MEDUSA_BACKEND_URL` do shell subiria o painel apontando para `localhost` e o
  # login de fora morreria em `ERR_FAILED`, com o `.env` mostrando o endereco
  # certo. Aviso alto, sem falhar — quem exportou a mao pode saber o que faz.
  for chave in "${CHAVES[@]}"; do
    if [ -n "${!chave+x}" ] && [ "${!chave}" != "$(env_get "$chave")" ]; then
      warn "o shell tem $chave='${!chave}' e o .env agora tem '$(env_get "$chave")'"
      printf '        %s\n' "o container le' o AMBIENTE: faca 'unset $chave' e rode de novo"
    fi
  done

  info "recriando backend e storefront para eles lerem o .env novo"
  compose up -d backend frontend >/dev/null 2>&1

  if aguardar_loja && aguardar_webhook; then
    info "a loja e o webhook voltaram a responder"
  else
    warn "os servicos ainda estao subindo — o teste abaixo pode falhar so' por isso"
  fi

  echo
  verificar "$url"
  echo

  if [ "${PROD:-0}" = "1" ]; then
    warn "em PROD, NEXT_PUBLIC_BASE_URL e' inlinado no BUILD — rode 'make build PROD=1' para ele valer"
  fi

  warn "quem abre o endereco no navegador ve antes uma pagina de aviso do ngrok"
  printf '        %s\n' "'Visit Site' uma vez basta; o envio do provedor nao passa por ela"

  info "o painel do admin sai no MESMO endereco: $url/painel"
  printf '        %s\n' "e' acesso administrativo publicado: a senha e' a unica porta (make admin-password)"

  return 0
}

# -----------------------------------------------------------------------------
# stop
# -----------------------------------------------------------------------------
cmd_stop() {
  if agente_vivo; then
    matar_agente
    ok "agente encerrado"
  else
    info "nenhum agente rodando"
  fi

  restaurar

  info "recriando backend e storefront"
  compose up -d backend frontend >/dev/null 2>&1

  echo
  info "o endereco publico deixou de existir: ate' o proximo 'make tunnel', um"
  printf '        %s\n' "pagamento nao encontra o webhook nem volta para a loja"
  printf '        %s\n' "e o painel volta a ser so' local: http://localhost:9000/painel"

  return 0
}

# -----------------------------------------------------------------------------
# status
# -----------------------------------------------------------------------------
cmd_status() {
  local url

  if agente_vivo; then
    url="$(url_do_agente)"
    ok "agente no ar -> $(destino_do_agente)"

    if [ -n "$url" ]; then
      info "endereco publico: $url"
      echo
      verificar "$url"
    fi
  else
    info "nenhum agente rodando ('make tunnel' publica a loja)"
  fi

  echo
  printf '  .env agora:\n'
  for chave in "${CHAVES[@]}"; do
    printf '    %-24s %s\n' "$chave" "$(env_get "$chave")"
  done

  echo
  printf '  painel do admin: http://localhost:9000/painel (local)\n'
  [ -n "$url" ] && printf '                   %s/painel (publico — acesso administrativo)\n' "$url"

  return 0
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *)
    echo "Uso: scripts/tunnel.sh start|stop|status" >&2
    exit 2
    ;;
esac

