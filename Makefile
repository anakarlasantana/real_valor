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

.PHONY: help up down restart logs logs-all ps build migrate seed clean-db shell-backend shell-frontend health logs-admin revalidate gen check doctor

help:
	@echo "Real Valor — comandos da stack Docker ($(MODE_LABEL))"
	@echo ""
	@echo "  Ciclo de vida"
	@echo "    make up            - Sobe a stack completa"
	@echo "    make down          - Para e remove os containers (preserva os dados)"
	@echo "    make restart       - Reinicia todos os containers"
	@echo "    make ps            - Status dos containers da stack"
	@echo "    make logs          - Logs do backend em tempo real"
	@echo "    make logs-all      - Logs de todos os servicos"
	@echo ""
	@echo "  Build e dados"
	@echo "    make build         - Reconstroi as imagens do backend e do frontend"
	@echo "    make migrate       - Aplica as migracoes do Medusa v2"
	@echo "    make seed          - Popula catalogo, conteudo da vitrine e o schema do CRM"
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
	@echo "    make check         - Falha se o artefato estiver velho ou o contrato incoerente"
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

# `seed` = comércio (`seed.ts`) + conteúdo da vitrine (`seed-content.ts`) +
# registro do schema (`seed-schema.ts`). Os três são idempotentes: rodar de novo
# numa base já semeada não altera nada.
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
# container velho com o nome ocupado, porta ja usada por outra coisa e
# publishable key do `.env` diferente da do banco (esse derruba a LOJA inteira
# com 500 e nenhuma mensagem aponta a chave).
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
gen:
	@node scripts/gen-content.mjs

check:
	@node scripts/gen-content.mjs --check
	@node scripts/check-contract-parity.mjs
	@echo ""
	@echo "  Contrato e artefato conferidos."

# ---------------------------------------------------------------------------
# Tipos: o `tsc` dos dois pacotes
# ---------------------------------------------------------------------------
# Fica FORA do `make check` de proposito: o hook de commit roda o `check`, e o
# `tsc` do storefront leva dezenas de segundos. E um alvo proprio, para a CI
# (F5) e para quem estiver fechando um trabalho grande rodar antes de subir.
#
# `--incremental false` porque e `--noEmit`: sem isso o `tsc` escreveria o
# `tsconfig.tsbuildinfo` e o cache de build ficaria invalido.
types:
	@cd backend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json --incremental false
	@cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json --incremental false
	@echo ""
	@echo "  Tipos conferidos nos dois pacotes."
