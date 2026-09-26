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

.PHONY: help up down restart logs logs-all ps build migrate seed clean-db shell-backend shell-frontend health logs-admin revalidate

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
	@echo "    make seed          - Popula o catalogo (roupas femininas + regras BR)"
	@echo "    make clean-db      - APAGA os volumes do banco e reinicia do zero"
	@echo ""
	@echo "  Utilitarios"
	@echo "    make shell-backend - Shell dentro do container do backend"
	@echo "    make shell-frontend- Shell dentro do container do storefront"
	@echo "    make health        - Checa /health do backend, a home da loja e o admin"
	@echo "    make logs-admin    - Falha se o Vite do admin nao resolveu modulos"
	@echo "    make revalidate TAG=products - Invalida o cache do storefront (ISR)"
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
migrate:
	$(COMPOSE) exec backend yarn medusa db:migrate

seed:
	$(COMPOSE) exec backend yarn seed

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
logs-admin:
	@test -n "$$($(COMPOSE) ps -q backend)" || { echo "backend nao esta rodando (rode 'make up')"; exit 1; }
	@if $(COMPOSE) logs --tail=400 backend 2>&1 | grep -aq "Failed to resolve import"; then \
	  echo "FALHA: o Vite do admin nao resolveu modulos (painel em branco). Ultimas ocorrencias:"; \
	  $(COMPOSE) logs --tail=400 backend 2>&1 | grep -a "Failed to resolve import" | tail -5; \
	  exit 1; \
	else \
	  echo "OK: nenhuma falha de resolucao do Vite nos ultimos 400 logs do backend."; \
	fi

revalidate:
	@test -n "$(TAG)" || { echo "uso: make revalidate TAG=products   (ou TAG=categories/collections)"; exit 1; }
	@curl -fsS -X POST "http://localhost:8000/api/revalidate?tag=$(TAG)" \
	  -H "x-revalidate-secret: $$($(COMPOSE) exec -T frontend printenv REVALIDATE_SECRET)" \
	  && echo " cache invalidado: $(TAG)"
