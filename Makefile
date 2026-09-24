.PHONY: help up down restart logs build migrate seed clean-db

help:
	@echo "Real Valor - Comandos do Backend"
	@echo "  make up       - Sobe todos os containers (Postgres, Redis, Medusa Backend)"
	@echo "  make down     - Para todos os containers"
	@echo "  make restart  - Reinicia todos os containers"
	@echo "  make logs     - Exibe os logs do backend em tempo real"
	@echo "  make build    - Reconstrói a imagem Docker do backend"
	@echo "  make migrate  - Executa as migrações do Medusa v2"
	@echo "  make seed     - Popula o banco com catálogo de roupas femininas e regras BR"
	@echo "  make clean-db - Limpa os volumes do banco de dados e reinicia do zero"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f backend

build:
	docker compose build

migrate:
	docker compose exec backend yarn medusa db:migrate

seed:
	docker compose exec backend yarn seed

clean-db:
	docker compose down -v
	docker compose up -d
