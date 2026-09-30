# =============================================================================
# Real Valor — Makefile
# =============================================================================
# Atalhos para a stack Docker. Toda a stack (Postgres, Redis, backend Medusa,
# storefront Next.js) roda em containers do projeto `real_valor`.
#
# O modo DEV e o padrao; use `PROD=1` para producao:
#     make up PROD=1
#
# O MODO e definido pela PRESENCA ou AUSENCIA do `-f`, nada mais:
#   sem `-f`  -> o Compose carrega `docker-compose.override.yml` por convencao
#                (bind mounts, `target: dev`, `yarn dev`)  = DESENVOLVIMENTO
#   com `-f`  -> o Compose carrega SOMENTE a base (imagens imutaveis, `runner`)
#                                                            = PRODUCAO
# E por isso que o `-f` aparece aqui e nao um overlay extra: um overlay a mais
# reintroduziria exatamente a divergencia que a base unica eliminou.
# =============================================================================

ifeq ($(PROD),1)
  COMPOSE := docker compose -f docker-compose.yml
  MODE_LABEL := PRODUCAO
else
  COMPOSE := docker compose
  MODE_LABEL := DESENVOLVIMENTO
endif

.PHONY: help up down restart recreate logs logs-all ps build migrate seed clean-db shell-backend shell-frontend health logs-admin revalidate gen test check types build-admin doctor

help:
	@echo "Real Valor — comandos da stack Docker ($(MODE_LABEL))"
	@echo ""
	@echo "  Ciclo de vida"
	@echo "    make up            - Sobe a stack completa"
	@echo "    make down          - Para e remove os containers (preserva os dados)"
	@echo "    make restart       - Reinicia todos os containers"
	@echo "    make recreate      - Recria os containers (resolve bind preso; SERVICE=<nome> recria so um)"
	@echo "    make ps            - Status dos containers da stack"
	@echo "    make logs          - Logs do backend em tempo real"
	@echo "    make logs-all      - Logs de todos os servicos"
	@echo ""
	@echo "  Build e dados"
	@echo "    make build         - Reconstroi as imagens do backend e do frontend"
	@echo "    make migrate       - Aplica as migracoes do Medusa v2"
	@echo "    make seed          - Popula catalogo, o conteudo (vitrine e tema) e o schema do CRM"
	@echo "    make clean-db      - APAGA os volumes do banco e reinicia do zero"
	@echo ""
	@echo "  Utilitarios"
	@echo "    make shell-backend - Shell dentro do container do backend"
	@echo "    make shell-frontend- Shell dentro do container do storefront"
	@echo "    make health        - Checa /health do backend, a home da loja e o admin"
	@echo "    make logs-admin    - Falha se o Vite do admin nao resolveu modulos ou serviu o index.html no lugar de um modulo (import dinamico quebrado)"
	@echo "    make revalidate TAG=products - Invalida o cache do storefront (ISR)"
	@echo ""
	@echo "  Contrato de conteudo"
	@echo "    make gen           - Regera o contrato do storefront (commit o diff)"
	@echo "    make check         - Falha se o artefato estiver velho, o contrato incoerente ou o CRM importando valor do backend"
	@echo ""
	@echo "  Testes, tipos e o CRM"
	@echo "    make test          - Jest do backend e do CRM (admin/), vitest do storefront"
	@echo "    make types         - tsc do backend, do storefront e do CRM (pacote admin/)"
	@echo "    make build-admin   - Compila o admin (Vite) — o gate de quem mexe no CRM"
	@echo ""
	@echo ""
	@echo "  Modo: use PROD=1 para producao (ex.: make up PROD=1)"

# ---------------------------------------------------------------------------
# Ciclo de vida
# ---------------------------------------------------------------------------
# Nao ha mais ORDEM obrigatoria de subida nem script `start.sh`/`stop.sh`: o
# build do storefront deixou de consultar o backend (o `generateStaticParams`
# foi removido em favor de ISR + `/api/revalidate`) e o Compose resolve a ordem
# por `depends_on` + `healthcheck` (backend so sobe com Postgres/Redis saudaveis).
up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

# ---------------------------------------------------------------------------
# Recriar: o caminho garantido para bind mount preso
# ---------------------------------------------------------------------------
# O caso medido (R7.1): o diretorio `admin/` mudou de inode quando o CRM saiu de
# `backend/src/admin`, e o container de DEV ficou montando o inode ANTIGO
# (vazio) em `/app/admin` — o painel subia sem o menu "Conteudo da vitrine" e
# nada acusava (host com 4 entradas, container com `total 0`; inode 26083381 x
# 26083369, e o mesmo mecanismo reproduzido do zero num container descartavel).
#
#   `docker compose up -d` sozinho NAO resolve: o Compose nao recria um servico
#     cuja configuracao nao mudou — foi por isso que o `make up` do dia nao
#     consertou nada.
#   `make restart` resolve o BIND (medido: a partida do container remonta o
#     mount e re-resolve o path de origem), mas nao recria o container.
#   `make recreate` e' o caminho garantido: recria do zero, entao pega imagem e
#     configuracao novas alem do mount.
#
# Desde a R7.1 a config falha alto nesse estado, e o `make doctor` aponta a causa
# como sendo do ambiente (e nao um bug do CRM).
#
# `SERVICE` e' opcional: `make recreate SERVICE=backend` recria so o backend,
# que e' o suficiente para o bind do CRM (e mais barato: nao reinicia o
# storefront). Sem ele, recria a stack inteira.
recreate:
	$(COMPOSE) up -d --force-recreate $(SERVICE)

ps:
	$(COMPOSE) ps

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------
logs:
	$(COMPOSE) logs -f backend

logs-all:
	$(COMPOSE) logs -f

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
# Cada repo tem o seu Dockerfile e cada modo fixa o estagio (`target: runner` em
# producao, `target: dev` no override). Nenhum build depende de rede nem do
# backend: `docker compose build` funciona 100% offline.
# Nao existe script auxiliar de build — `scripts/build-frontend.sh` foi removido
# junto com o `generateStaticParams` que o tornava necessario.
build:
	$(COMPOSE) build

# ---------------------------------------------------------------------------
# Dados
# ---------------------------------------------------------------------------
# `migrate`, `seed` e `seed-schema` rodam com `-u root` de proposito: em DEV o
# `/app/node_modules` e' um volume anonimo herdado da imagem (dono root), e o
# runner de migration quer criar `dist/migrations` dentro dos pacotes — sem
# isso, `make migrate` morre com EACCES. A aplicacao em si (medusa develop,
# next dev) segue sem root.
migrate:
	$(COMPOSE) exec -u root backend yarn medusa db:migrate

# `seed` = comércio (`seed.ts`) + conteúdo (`seed-content.ts`) + registro do
# schema (`seed-schema.ts`). Os três são idempotentes: rodar de novo numa base
# já semeada não altera nada.
#
# O `seed-content` popula as **duas** superfícies de conteúdo: as seções da
# vitrine e as estações do tema (a mesma lista que o gerador escreve em
# `frontend/themes/`, e que a loja lê do payload desde a R5).
#
# O conteúdo entra aqui para uma base nova nascer montada sem ninguém precisar
# abrir o painel — e é a MESMA regra do botão "Restaurar padrão" do CRM
# (`backend/src/modules/content/restore.ts`): só cria o que falta.
seed:
	$(COMPOSE) exec -u root backend yarn seed
	$(COMPOSE) exec -u root backend yarn seed-content
	$(COMPOSE) exec -u root backend yarn seed-schema

# O registro do schema do CRM no Postgres: o contrato e o bootstrap, o banco e
# a fonte em runtime. Entra no `seed` porque um banco novo precisa dele para o
# CRM deixar de servir o bootstrap.
seed-schema:
	$(COMPOSE) exec -u root backend yarn seed-schema

# So confere: nao grava nada e sai != 0 quando o registro esta velho (ou nao
# existe). E o que a CI chama depois de `make check`.
check-schema:
	$(COMPOSE) exec -u root backend yarn check-schema

clean-db:
	@echo "AVISO: isto vai APAGAR os dados do Postgres e do Redis."
	@read -r -p "Confirma? Digite 'sim' para continuar: " r; [ "$$r" = "sim" ] || { echo "Cancelado."; exit 1; }
	$(COMPOSE) down -v
	$(COMPOSE) up -d postgres redis

# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------
shell-backend:
	$(COMPOSE) exec backend sh

shell-frontend:
	$(COMPOSE) exec frontend sh

health:
	@echo "Backend /health:"
	@curl -fsS http://localhost:9000/health && echo "" || echo "  INDISPONIVEL"
	@echo "Storefront (home /br):"
	@curl -fo /dev/null -s -w "  HTTP %{http_code}\n" -L http://localhost:8000/br || echo "  INDISPONIVEL"
	@echo "Painel admin (/painel):"
	@curl -fo /dev/null -s -w "  HTTP %{http_code}\n" -L http://localhost:9000/painel || echo "  INDISPONIVEL"
	@echo "  OBS: 200 aqui nao garante o bundle — rode 'make logs-admin' tambem."

# O HTML do admin responde 200 mesmo quando o Vite falha em resolver os modulos
# de extensao (o painel abre em branco). Este alvo olha o que importa: o log.
#
# Sao DUAS falhas diferentes:
#   1. "Failed to resolve import" — o Vite diz na cara que nao achou o modulo.
#   2. Requisicao de modulo logada com 200 — o dev server do admin sobe com
#      `appType: spa`, entao URL de modulo inexistente NAO da 404: cai no
#      fallback e recebe o `index.html` (200, text/html), e o browser quebra com
#      "Error loading dynamically imported module".
#      O `@medusajs/framework` SILENCIA no log tudo que contenha `@fs`, `@id`,
#      `@vite`, `@react` ou `node_modules` (NOISY_ENDPOINTS_CHUNKS, em
#      @medusajs/framework/dist/http/express-loader.js): as requisicoes que
#      RESOLVEM nao aparecem. Logo, modulo logado com 200 = modulo que NAO
#      resolveu. E' a unica pista desse erro — e ela parece inofensiva.
ADMIN_FALLBACK_200 := GET /painel/(@fs|@id|@vite|@react|node_modules).*[(]200[)]

logs-admin:
	@test -n "$$($(COMPOSE) ps -q backend)" || { echo "backend nao esta rodando (rode 'make up')"; exit 1; }
	@if $(COMPOSE) logs --tail=400 backend 2>&1 | grep -aq "Failed to resolve import"; then \
	  echo "FALHA: o Vite do admin nao resolveu modulos (painel em branco). Ultimas ocorrencias:"; \
	  $(COMPOSE) logs --tail=400 backend 2>&1 | grep -a "Failed to resolve import" | tail -5; \
	  exit 1; \
	elif $(COMPOSE) logs --tail=400 backend 2>&1 | grep -aqE "$(ADMIN_FALLBACK_200)"; then \
	  echo "FALHA: o browser pediu um modulo do admin e o fallback da SPA respondeu o index.html (200)."; \
	  echo "       E' um import dinamico quebrado ('Error loading dynamically imported module')."; \
	  echo "       Causa tipica: HMR do Vite fora de alcance (aba presa no grafo de modulos velho)."; \
	  echo "Ultimas ocorrencias:"; \
	  $(COMPOSE) logs --tail=400 backend 2>&1 | grep -aE "$(ADMIN_FALLBACK_200)" | tail -5; \
	  echo "Correcao: reload forcado no browser (Ctrl+Shift+R). Se voltar, confira o HMR_PORT do"; \
	  echo "          docker-compose.override.yml e se a porta esta publicada (make health)."; \
	  exit 1; \
	else \
	  echo "OK: nenhuma falha do Vite do admin nos ultimos 400 logs do backend."; \
	fi

revalidate:
	@test -n "$(TAG)" || { echo "uso: make revalidate TAG=products   (ou TAG=categories/collections)"; exit 1; }
	@curl -fsS -X POST "http://localhost:8000/api/revalidate?tag=$(TAG)" \
	  -H "x-revalidate-secret: $$($(COMPOSE) exec -T frontend printenv REVALIDATE_SECRET)" \
	  && echo " cache invalidado: $(TAG)"

# ---------------------------------------------------------------------------
# Diagnostico do ambiente local (le e nao mexe)
# ---------------------------------------------------------------------------
# Existe porque os problemas que derrubam `make up` nao dizem na cara do erro:
# container velho com o nome ocupado, porta ja usada por outra coisa, publishable
# key do `.env` diferente da do banco (esse derruba a LOJA inteira com 500 e
# nenhuma mensagem aponta a chave) e o bind do CRM preso a um diretorio orfao (o
# painel sobe sem o menu "Conteudo da vitrine", sem erro nenhum, e o sintoma
# parece bug do CRM — ver o check 6 do script).
doctor:
	@scripts/doctor.sh

# ---------------------------------------------------------------------------
# Contrato de conteudo: gerar e verificar
# ---------------------------------------------------------------------------
# O contrato tem uma fonte so (`backend/src/modules/content/`), mas o
# storefront e um pacote npm separado e nao consegue importa-la. O artefato
# `frontend/src/lib/content/contract.generated.ts` e GERADO daquela fonte e
# versionado: contrato novo e `make gen` + commit do diff.
#
# `make check` e o que o hook de commit roda. Ele nao precisa da stack de pe
# (e so Node lendo arquivos), entao serve tambem para o pre-push e a CI.
#
# A verificacao da SUITE do CRM (`scripts/check-panel-tests.mjs`, R2) nao mora
# aqui de proposito: ela pergunta ao jest do CRM o que ele vai rodar, e o job
# `guard` da CI nao instala `node_modules` nenhum — este alvo tem que continuar
# rodando em segundos, sem instalacao. Ela roda no `make test`, que e' onde a
# suite roda e onde as dependencias existem.
gen:
	@node scripts/gen-content.mjs

check:
	@node scripts/gen-content.mjs --check
	@node scripts/check-contract-parity.mjs
	@node scripts/check-boundaries.mjs
	@echo ""
	@echo "  Contrato, artefato e fronteira conferidos."

# ---------------------------------------------------------------------------
# Build do admin: o gate de quem mexe no CRM
# ---------------------------------------------------------------------------
# `medusa build` compila o admin (Vite) para `.medusa/server/public/admin` — o
# MESMO comando que o estagio `builder` da imagem roda (`RUN yarn build` no
# backend/Dockerfile). Aqui ele roda avulso, para medir uma mudanca no CRM sem
# reconstruir a imagem inteira.
#
# POR QUE EM CONTAINER AVULSO (`compose run`) E NAO `compose exec`: o build do
# admin precisa de mais heap do que o limite do servico em DEV. Medido na R7 —
# com o limite de 2G do `docker-compose.override.yml`, o build morre em
#     FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
# (o heap chega a ~1 GB e o `medusa develop`, que ja roda no mesmo container,
# come o resto). O container do `compose run` e proprio: mesmo limite, sem o dev
# server dentro, e o `NODE_OPTIONS` abaixo da heap suficiente ao Vite. No estagio
# `builder` da imagem nada disso e preciso — `docker build` nao passa pelos
# limites de recurso do Compose.
#
# Em DEV o CRM entra no build pelo `admin.sources` do `backend/medusa-config.ts`,
# que aponta para `/app/admin` — o `docker-compose.override.yml` monta `./admin`
# la. Alvo de DEV: em `PROD=1` a imagem e a `runner`, sem as devDependencies que
# o Vite precisa.
#
# POR QUE ESTE ALVO CONFERE A LINHA DE SUCESSO (medido na R2): o `medusa build`
# sai **0 mesmo quando o painel nao compila**. Medido com um import de valor pelo
# apelido `@conteudo/*` (que o Rollup nao resolve): o log trouxe
#     x Build failed in 8.55s
#     error: Unable to compile frontend source
#     [vite]: Rollup failed to resolve import "@conteudo/contract" from …
# e o `$?` do `yarn build` foi **0** — nos dois casos (com e sem o defeito). Um
# gate que so olha o exit code diria "verde" com o painel quebrado, que e' pior do
# que nao ter gate. Por isso o alvo guarda o log e exige a linha
# `Frontend build completed successfully` (a mesma que a R7 leu para fechar a
# medicao do build). Se o Medusa mudar essa mensagem, este alvo falha — alto e
# claro, que e' o comportamento desejado.
ADMIN_BUILD_LOG ?= /tmp/real-valor-build-admin.log

build-admin:
	@test -n "$$($(COMPOSE) ps -q postgres)" || { echo "postgres nao esta rodando (rode 'make up')"; exit 1; }
	@$(COMPOSE) run --rm -T -e NODE_OPTIONS=--max-old-space-size=1536 backend yarn build 2>&1 | tee "$(ADMIN_BUILD_LOG)"
	@grep -q "Frontend build completed successfully" "$(ADMIN_BUILD_LOG)" || { echo ""; echo "  O painel NAO compilou (procure 'Rollup failed to resolve' ou 'Build failed' no log acima)."; exit 1; }
	@echo ""
	@echo "  Admin compilado no container (bundle em .medusa/server/public/admin)."

# ---------------------------------------------------------------------------
# Testes: o jest do backend, o jest do CRM e o vitest do storefront
# ---------------------------------------------------------------------------
# Os tres sao de UNIDADE e nao precisam da stack de pe nem de banco: o setup do
# jest do backend zera o `MetadataStorage` do MikroORM (`integration-tests/
# setup.js`), o teste do CRM e' de funcao pura (e o runner dele nem carrega esse
# setup) e os specs do storefront tambem. Por isso este alvo serve o terminal, o
# pre-push e a CI sem `make up` antes — a mesma propriedade do `make check`.
#
# Ate agora os testes existiam nos `package.json` (`test:unit` no backend,
# `test` no storefront) e ninguem os chamava: nem o `make`, nem o hook de
# commit, nem a CI. Teste que nao roda e' documentacao. O que este alvo passa a
# exigir, em numero, hoje: 10 suites / 142 testes no backend, 1 suite / 12 testes
# no CRM e 3 arquivos / 20 testes no storefront. O total — 11 suites / 154 testes
# — e' o de antes da R2 menos os tres que a R3-lite tirou (as comparacoes de
# previa do tema, que viraram geracao: comparar o artefato com a origem dele so
# podia dar verde), e a divisao 10 + 1 = 11 e' a medida de que o teste que saiu do
# `roots` do backend entrou no runner do CRM inteiro (142 + 12 = 154).
#
# A linha do CRM e' a mudanca da R2. Ate' entao o teste do painel rodava na
# PRIMEIRA linha, por um `roots` do `backend/jest.config.js` que apontava para
# `../admin/src`: o vizinho declarava o que era teste do painel, e uma limpeza
# banal nesse `roots` faria a suite sumir sem dizer nada. Agora o CRM tem config
# proprio (`admin/jest.config.js`) e este alvo chama o runner DELE: o binario
# continua sendo o do backend (`../backend/node_modules/.bin/jest`) porque o CRM
# nao tem instalacao propria — o resto medido que a G5 fecha.
#
# Sem `--runInBand`/`--forceExit` na linha do CRM: os dois existem na linha do
# backend por causa do `MetadataStorage` global, que o teste do painel nao toca
# (medido: o runner do CRM sai limpo, 0,47s). E sem `--passWithNoTests`: se a
# suite do CRM desaparecer, o jest falha com "No tests found" em vez de passar
# verde.
#
# Depois da linha do CRM vem `scripts/check-panel-tests.mjs`, que fecha a perda
# PARCIAL (a que o jest nao ve): ele compara os specs que existem no disco com os
# que o runner do CRM lista (`--listTests`, sem rodar nada, ~0,25s). Um spec
# renomeado para um sufixo que o `testMatch` nao cobre reprova — antes ficava
# verde, rodando menos. Ele mora aqui e nao no `make check` porque precisa de
# `node_modules`; ver o comentario do alvo `check`.
#
# `--silent --runInBand --forceExit` na linha do backend sao os mesmos do script
# de la, sem mudanca: os specs compartilham o `MetadataStorage` global do
# MikroORM, entao arquivo em paralelo e' corrida entre arquivos. `--silent`
# esconde o log de aplicacao para a falha aparecer sozinha no terminal.
test:
	@cd backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest --silent --runInBand --forceExit
	@cd admin && ../backend/node_modules/.bin/jest -c jest.config.js
	@node scripts/check-panel-tests.mjs
	@cd frontend && ./node_modules/.bin/vitest run
	@echo ""
	@echo "  Testes conferidos nos tres pacotes (backend, CRM e storefront)."

# ---------------------------------------------------------------------------
# Tipos: o `tsc` dos dois pacotes — e o do painel, que tem regras proprias
# ---------------------------------------------------------------------------
# Fica FORA do `make check` de proposito: o hook de commit roda o `check`, e o
# `tsc` do storefront leva dezenas de segundos. E um alvo proprio, para a CI
# (F5) e para quem estiver fechando um trabalho grande rodar antes de subir.
#
# O terceiro `tsc` e o do CRM (`admin/tsconfig.json`): desde a R7 o painel e um
# pacote IRMAO do backend (bundle proprio, React 18) e o tsconfig dele e MAIS
# estrito que o do backend — `strict` + `noUnusedLocals`, que foi justamente o
# que pegou um import de tipo morto na pagina do conteudo. Os tipos vem do
# `node_modules` do backend por `paths`/`typeRoots`: o CRM nao tem instalacao
# propria (quem compila o painel e o Vite do backend). Ver admin/tsconfig.json.
#
# O `paths` do painel carrega tambem o apelido `@conteudo/*` (R2): e por ele que
# o painel importa TIPO do modulo de conteudo do backend, em vez de subir cinco
# niveis de `..`. Este `tsc` verde e o que prova que os tres arquivos do CRM que
# citam o modulo estao ligados de verdade — o apelido sozinho nao valeria nada.
# Import de VALOR por ele quem reprova e' `scripts/check-boundaries.mjs`.
#
# `--incremental false` porque e `--noEmit`: sem isso o `tsc` escreveria o
# `tsconfig.tsbuildinfo` e o cache de build ficaria invalido.
types:
	@cd backend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json --incremental false
	@cd backend && ./node_modules/.bin/tsc --noEmit -p ../admin/tsconfig.json
	@cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json --incremental false
	@echo ""
	@echo "  Tipos conferidos nos dois pacotes (e no painel)."
