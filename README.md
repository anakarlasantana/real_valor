# Real Valor — E-commerce de Moda Feminina (Medusa v2 + Next.js 15)

Este projeto implementa a loja virtual de moda feminina **Real Valor**, baseada no ecossistema **Medusa v2** (backend headless) com storefront em **Next.js 15 (App Router)**, PostgreSQL e Redis — **toda a stack roda em Docker**.

---

## 🚀 Subir a Stack

```bash
make up            # DESENVOLVIMENTO (padrão)
make up PROD=1     # PRODUÇÃO
make down          # para e remove os containers (preserva os volumes)
```

Os únicos pré-requisitos são **Docker + Compose v2** (e `curl`, usado por `make health`): Node, Yarn e Corepack rodam **dentro das imagens**.

> ⚠️ **Não existem mais `start.sh`, `stop.sh` nem `build-frontend.sh`**, e não há ordem obrigatória de subida — veja [Sem ordem obrigatória de subida](#-sem-ordem-obrigatória-de-subida).

---

## 🧭 Como a Aplicação Roda Localmente

### Um único arquivo Compose; o "modo" é a presença do `-f`

Não há overlays `dev`/`prod` separados. A regra é uma só, e ela vem do próprio Compose:

| Comando | O que o Compose carrega | Modo resultante |
| :--- | :--- | :--- |
| `docker compose up -d` (ou `make up`) | `docker-compose.yml` **+** `docker-compose.override.yml` (convenção automática) | **DEV** — bind mounts do código, `target: dev`, `yarn dev`, `RUN_MIGRATIONS=0` |
| `docker compose -f docker-compose.yml up -d` (ou `make up PROD=1`) | **somente** `docker-compose.yml` | **PROD** — imagem imutável, `target: runner`, `yarn start`, `RUN_MIGRATIONS=1`, limites de memória e rotação de log |

Ou seja: **o `-f` é o seletor de modo**. Por isso não existe `docker-compose.prod.yml` — um overlay a mais reintroduziria exatamente a divergência que a base única eliminou. A base é a única fonte de verdade dos serviços; o override é apenas a conveniência do desenvolvimento.

### Arquitetura de execução

```
docker compose up -d
│
├── postgres   → real_valor_postgres    127.0.0.1:5438 → 5432   (healthcheck: pg_isready)
├── redis      → real_valor_redis       127.0.0.1:6381 → 6379   (healthcheck: redis-cli ping)
│
├── backend    → real_valor_backend     :9000
│      depends_on: postgres + redis (service_healthy)
│      └── backend/docker-entrypoint.sh
│            ├── aguarda o Postgres aceitar conexões (pg_isready, até 60 tentativas)
│            ├── roda `yarn medusa db:migrate` (somente se RUN_MIGRATIONS=1 → PROD)
│            ├── cria/verifica o usuário admin (idempotente)
│            └── exec do CMD do container:
│                  DEV  → yarn dev   (`medusa develop`: watch + admin via Vite)
│                  PROD → yarn start (`medusa start`: artefato compilado)
└── frontend   → real_valor_frontend    :8000
       depends_on: backend
       └── DEV  → yarn dev   (`next dev --turbopack -p 8000`)
           PROD → yarn start (`next start -p 8000`, saída standalone)
```

### Sem ordem obrigatória de subida

O `next build` do storefront **não consulta mais o backend**: o `generateStaticParams()` que chamava a Store API foi removido em favor de **ISR + `POST /api/revalidate`**. Consequências práticas:

1. `docker compose build` funciona **offline** — não precisa do backend no ar.
2. A ordem backend→frontend deixou de ser obrigatória; as dependências reais são resolvidas por `depends_on` + `healthcheck`.
3. Publicar uma alteração de catálogo antes da janela de ISR expirar é feito com `make revalidate TAG=products` (veja [Comandos](#-comandos)).

Ressalva: em DEV o `next dev` compila sob demanda e fala com o backend em runtime (SSR). Com o backend fora do ar, as páginas que dependem da Store API degradam conforme os fallbacks do código.

### Variáveis de ambiente

O Compose lê o **`.env` da raiz automaticamente** — não há `--env-file` nem `env_file:` nos serviços. Crie-o a partir do modelo versionado:

```bash
cp .env.example .env
```

> O nome é `.env` (e não `.env.docker`) exatamente porque o carregamento é o automático do Compose. Ele documenta a distinção central **URL interna (container→container, ex. `http://backend:9000`) vs URL pública (browser, ex. `http://localhost:9000`)**. Confundir as duas é a causa mais comum de falha em setups Medusa + Docker.

| Arquivo | Usado por | Aponta para |
| :--- | :--- | :--- |
| `.env` (raiz, **não versionado**) | **todos** os containers, via Compose — inclusive as `NEXT_PUBLIC_*` do storefront | `postgres:5432` / `redis:6379` / `backend:9000` |
| `backend/.env` (**não versionado**) | backend rodando **no host** (CLI Medusa, fora do Docker) | `localhost:5438` / `localhost:6381` |
| `frontend/.env.local` (**não versionado**) | storefront rodando **no host** (`next dev`/`next build` pela CLI) | `http://localhost:9000` |
| `frontend/.env.template` (versionado) | modelo do `frontend/.env.local` — só para quem roda o storefront sem Docker | `http://localhost:9000` |

> São **dois arquivos de ambiente distintos, para dois modos de execução distintos**: o `.env` da raiz é o único que os containers leem; o `backend/.env` e o `frontend/.env.local` existem para quem roda as CLIs no host (portas `5438`/`6381` em vez de `postgres`/`redis`). Antes existia um `.env.docker` (e um `backend/.env.docker`) só para o Compose: foram removidos porque o Compose já lê o `.env` da raiz sozinho — o arquivo extra era uma segunda fonte de verdade que saía de sincronia.

> 🔑 O frontend carrega `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (`pk_...`). Sem ela a Store API responde `400 not_allowed — Publishable API key required`, mesmo com o backend no ar. Veja **Configurações → Chaves de API** no Admin ou a tabela `api_key` no banco.
>
> A chave sai do **`.env` da raiz** (o único arquivo que os containers leem), **não** do `frontend/.env.local` — esse vale só para quem roda o storefront no host. Faltando o valor, o Compose injeta o placeholder `pk_test`: em **DEV** isso derruba a home com **HTTP 500** (`A valid publishable key is required to proceed with the request`, em `frontend/src/middleware.ts`) a cada request; em **PROD** o build já teria inlinado `pk_test` no bundle.

**Verificação rápida do backend (inclui a chave):**

```bash
curl -s -H "x-publishable-api-key: $(grep NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY .env | cut -d= -f2)" \
  http://localhost:9000/store/content | head -c 120
```
### Containers, portas e logs

| Componente | Container | Porta (host→container) | Logs |
| :--- | :--- | :--- | :--- |
| PostgreSQL | `real_valor_postgres` | **5438** → 5432 | `docker logs real_valor_postgres` |
| Redis | `real_valor_redis` | **6381** → 6379 | `docker logs real_valor_redis` |
| Medusa Backend | `real_valor_backend` | **9000** → 9000 | `docker logs -f real_valor_backend` |
| Storefront | `real_valor_frontend` | **8000** → 8000 | `docker logs -f real_valor_frontend` |

> As portas `5438` e `6381` são intencionais: evitam conflito com as portas padrão `5432`/`6379` de outras stacks da máquina. Postgres e Redis são publicados **apenas no loopback** (`127.0.0.1`), para inspeção local — o frontend e o backend falam com eles pela rede interna `real_valor_net`.

### Comandos

Tudo passa pelo `Makefile` (que nada mais é que um atalho para `docker compose`, respeitando o seletor de modo):

| Comando | O que faz |
| :--- | :--- |
| `make up` / `make up PROD=1` | Sobe a stack completa em **DEV** / **PROD** (`build` não é implícito). |
| `make down` | Para e remove os containers (preserva os volumes de dados). |
| `make restart` | Reinicia todos os containers. |
| `make ps` | Status dos containers da stack. |
| `make build` | Reconstrói as imagens do backend e do frontend (offline). |
| `make logs` / `make logs-all` | Logs do backend / de todos os serviços (follow). |
| `make migrate` / `make seed` | `yarn medusa db:migrate` / `yarn seed` **dentro do container**. |
| `make clean-db` | Remove os volumes e reinicia Postgres/Redis — **APAGA O BANCO** (pede confirmação). |
| `make shell-backend` / `make shell-frontend` | Shell dentro do container correspondente. |
| `make health` | Checa `/health` do backend e a home da loja (`/br`). |
| `make revalidate TAG=products` | Invalida o cache do storefront (ISR) usando o `REVALIDATE_SECRET` do container. |

### Operação do dia a dia

```bash
# Acompanhar os logs
docker logs -f real_valor_backend
docker logs -f real_valor_frontend
make logs        # backend
make logs-all    # todos

# Reiniciar somente o backend
docker compose restart backend          # DEV
make restart PROD=1                     # PROD (todos)

# Reprocessar migrations manualmente (ex.: após um git pull com novas migrations)
make migrate

# Popular o catálogo
make seed

# Publicar uma alteração de catálogo imediatamente (sem esperar a janela de ISR)
make revalidate TAG=products
```

### Ressalvas importantes do fluxo atual

1. **`NEXT_PUBLIC_*` se comporta de forma diferente em cada modo.** O valor chega ao container pelo `environment:` do Compose, interpolado do `.env` da raiz:
   - **DEV** (`next dev`): lido em **runtime**, a cada request. Alterar o `.env` exige apenas `make restart`. Se a variável estiver *ausente*, o Compose cai no placeholder `pk_test` e a home responde **500** (`A valid publishable key is required to proceed with the request` no log do storefront) — é o mesmo placeholder que existe para o build de PROD não abortar.
   - **PROD** (`output: standalone`): **inlinado no bundle** pelo `next build` (via os `args` do serviço `frontend`). Alterar exige `make build && make restart`; mexer só no `environment:` **não** muda o JavaScript já compilado.
   Vale para `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` e `NEXT_PUBLIC_STRIPE_KEY`.
2. **Migrations:** em DEV elas **não** rodam a cada restart (`RUN_MIGRATIONS=0`, para que o `seed` continue válido) — aplique sob demanda com `make migrate`. Em PROD (`RUN_MIGRATIONS=1`) elas rodam no boot, dentro do `docker-entrypoint.sh`.
3. **`REVALIDATE_SECRET` é obrigatório para habilitar o purge.** Sem ele o `POST /api/revalidate` responde `500` e não invalida nada (fail-closed). O Compose **não** fornece default: um segredo padrão conhecido transformaria um purge autenticado em purge público. Gere com `openssl rand -hex 32`.
4. **Os volumes preservam seus dados.** `real_valor_pgdata` e `real_valor_redisdata` têm nome fixo (sem prefixo de projeto), então `make down` seguido de `make up` **não** apaga o banco. Só `make clean-db` (ou `docker compose down -v`) remove os dados.
5. **O projeto é isolado das demais stacks da máquina.** Rode os comandos na raiz do repositório (`make up` já fixa o `-f` quando necessário) e nunca toque em `devops_*`, `traefik_network` ou `sin-frontend-dev` (porta 8080): são de outros projetos.

---

## 📁 Estrutura do Projeto

```
real_valor/
├── docker-compose.yml            # base ÚNICA: serviços, redes, volumes, portas
├── docker-compose.override.yml   # overlay de DEV (bind mounts + `target: dev`)
├── Makefile                      # atalhos; `PROD=1` seleciona o modo
├── .env.example                  # modelo do `.env` da raiz
├── .nvmrc                        # Node 22 (a mesma versão usada nas imagens)
├── scripts/
│   ├── check-contract-parity.mjs # confere o contrato storefront ↔ Store API
│   └── vendor-fonts.mjs          # (re)baixa e valida os `.woff2` self-hosted
│
├── backend/                          # Medusa v2 — Store API + Admin
│   ├── Dockerfile                    # deps → builder → runner (PROD) | deps → dev (DEV)
│   ├── docker-entrypoint.sh          # espera o Postgres, migrations, cria admin, exec do CMD
│   ├── medusa-config.ts              # módulos, CORS, Redis, database
│   ├── integration-tests/            # specs HTTP (health, store)
│   └── src/
│       ├── modules/content/          # módulo local `content` (conteúdo editorial da marca)
│       ├── api/store/ api/admin/     # rotas customizadas da Store API e do Admin
│       ├── admin/                    # extensões do painel (rotas + i18n pt-BR)
│       ├── jobs/ links/ subscribers/ workflows/
│       └── scripts/                  # `seed.ts` (admin/região/chaves) e `seed-content.ts`
│
└── frontend/                         # Next.js 15 (App Router) — storefront
    ├── Dockerfile                    # deps → builder → runner (standalone, PROD) | deps → dev (DEV)
    ├── next.config.js                # traz o `checkEnvVariables()` (aborta o build sem a chave)
    ├── themes/                       # temas lidos em RUNTIME por `src/lib/theme.ts`
    └── src/
        ├── app/fonts/                # fontes SELF-HOSTED (`.woff2`) + README do porquê
        ├── app/[countryCode]/        # rotas da loja: `/br`, `/br/store`, produto, carrinho…
        ├── app/api/revalidate/       # `POST /api/revalidate` (purge de ISR por tag)
        ├── modules/                  # componentes por domínio (products, cart, checkout…)
        ├── lib/                      # dados, contexto, tema, utilitários
        └── middleware.ts             # resolve o `countryCode` da URL
```

Os dois repos seguem o **mesmo padrão de Dockerfile**: `deps` (instala tudo, uma vez) → `builder` (compila) → `runner` (só o artefato). O estágio final de cada Dockerfile é o de **produção**, e é justamente por isso que o modo nunca pode depender do estágio default: a base fixa `target: runner` e o override fixa `target: dev`.

---

## 🔤 Fontes (self-hosted)

As fontes ficam em `frontend/src/app/fonts/` e são consumidas por **`next/font/local`** (`src/app/layout.tsx`). Não há mais `next/font/google`, portanto **o `next build` não faz requisição à CSS API do Google** e não depende de rede:

| Família | Arquivo | Tipo |
| :--- | :--- | :--- |
| Montserrat | `montserrat/montserrat-latin.woff2` | variável (`wght`) |
| Playfair Display | `playfair-display/playfair-display-latin.woff2` | variável (`wght`) |
| Allura | `allura/allura-latin.woff2` | estática (400) |

O sintoma original, o motivo da troca e **como regenerar os arquivos** estão em [`frontend/src/app/fonts/README.md`](frontend/src/app/fonts/README.md). A regeneração é um comando único — `node scripts/vendor-fonts.mjs`, da raiz — que baixa os `.woff2` + `OFL.txt`, valida cada `weight` contra o eixo real da fonte (fontkit) e confere o md5 contra o arquivo que o build do `next/font/google` havia gerado em `.next/static/media/`. Os binários estão cobertos por `*.woff2 binary` no `.gitattributes`, então o Git não tenta tratá-los como texto.

---

## 🛠 Troubleshooting

### 1. Backend em restart loop: `Cannot find module 'ts-node'` / `'/app/src/modules/content'`

Sintoma nos logs (`docker logs real_valor_backend`):

```
ts-node cannot be loaded and used, if you are running in production don't forget to set your NODE_ENV to production
Error: Cannot find module 'ts-node'
Error in loading config: Cannot find module '/app/src/modules/content'
```

**Causa:** o container de **DEV** está rodando uma imagem de **PROD**. `medusa develop` (o `yarn dev` do override) carrega `medusa-config.ts` e os módulos TypeScript via **`ts-node`**, que é devDependency — e o estágio `runner` remove as devDependencies de propósito (`yarn workspaces focus --production`). Sem `ts-node`, o `medusa-config.ts` não carrega; a partir daí todo `require` de configuração do projeto falha em cascata, inclusive o do módulo local `content` (o erro que aparece por último é o mais enganoso).

**Diagnóstico (2 comandos):**

```bash
# Imagem que o container em execução realmente usa
docker inspect -f '{{.Config.Image}}' real_valor_backend

# Estágio/tag que o Compose quer naquele modo
docker compose config | grep -E 'image: real_valor_backend'      # DEV  -> :dev
docker compose -f docker-compose.yml config | grep -E 'image: real_valor_backend'  # PROD -> :local
```

Em DEV, a imagem **tem** de ser `real_valor_backend:dev`. Se aparecer `:local`, é a imagem de produção.

**Por que acontecia:** os dois modos escreviam na mesma tag (`real_valor_backend:local`). Um `make build PROD=1` reconstruía a tag **por baixo** do container de DEV, que continuava rodando `yarn dev` — agora sobre uma imagem sem devDependencies. Hoje as tags são distintas por default (`:dev` no override, `:local` na base) e há um comentário no `docker-compose.override.yml` travando essa separação.

**Correção:**

```bash
make build                                              # reconstrói com `target: dev`
docker compose up -d --force-recreate --renew-anon-volumes
```

O `--renew-anon-volumes` (ou `-V`) **é obrigatório aqui**: o volume anônimo `/app/node_modules` é herdado do container anterior, então recriar o container sem renová-lo manteria a árvore de produção (sem `ts-node`) e o erro voltaria idêntico.

### 2. Outros sintomas frequentes

| Sintoma | Causa | Correção |
| :--- | :--- | :--- |
| Loja sem dados / requisições bloqueadas por **CORS** | `.env` antigo apontando para `http://localhost:3000`, porta da era pré-Docker | Ajuste `STORE_CORS`/`NEXT_PUBLIC_BASE_URL` para `:8000` e rode `make restart`. Em DEV mudar `NEXT_PUBLIC_*` já vale (runtime); em PROD exige `make build && make restart` |
| Storefront devolve **HTTP 500** e o log do container mostra `Error: A valid publishable key is required to proceed with the request` (`src/middleware.ts:40`) | `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` **ausente no `.env` da raiz**: o Compose cai no placeholder `pk_test` e, em DEV, o `next dev` lê esse valor em **runtime** a cada request | Copie a chave do Admin (Configurações → Chaves de API) ou rode `make seed`, ponha no `.env` da raiz e rode `make restart` — em DEV **não** precisa reconstruir (é runtime) |
| API responde `400 not_allowed — Publishable API key required` (e páginas de produto viram 404) | a mesma chave ausente/desatualizada, só que em **PROD**: ali o valor já foi **inlinado no bundle** pelo `next build`, então corrigir o `.env` não muda o JavaScript compilado | Corrija a chave no `.env` da raiz e **reconstrua**: `make build && make restart` |
| `next build` falha com `err: url(...) failed to parse` (domínio `gstatic`/`fonts.googleapis`) | alguma fonte voltou a usar `next/font/google`, que busca CSS do Google **durante o build** | Use `next/font/local` como em `src/app/fonts/` — ver [`frontend/src/app/fonts/README.md`](frontend/src/app/fonts/README.md) |
| Build aborta com `Failed to collect page data for /[countryCode]/categories/[...category]` | alguma página voltou a declarar `generateStaticParams()` e chama a Store API em build time | Remova a chamada: as páginas renderizam sob demanda com ISR + `POST /api/revalidate`. O build **tem** de ser offline |
| Migrations travam / `connection timed out` | `DATABASE_URL` sem `?sslmode=disable` contra um Postgres com `ssl = off`: o Medusa tenta TLS e pendura até o timeout | O Compose já embute `?sslmode=disable`; mantenha a query string em qualquer URL nova |
| `Address already in use` em 5438, 6381, 8000 ou 9000 | outra stack na máquina usando a mesma porta | `docker compose ps` e `ss -ltnp` para identificar. **Não** desça serviços de outros projetos (`devops_*`, `sin-frontend-dev` usa 8080) |
| Alterei o `.env` e o browser continua igual | em **PROD** a `NEXT_PUBLIC_*` foi **inlinada no bundle** pelo `next build`; em DEV o valor é lido em runtime a cada request, então a causa costuma ser o container antigo (não recriado) | DEV: `make restart`. PROD: `make build && make restart` |
| `POST /api/revalidate` responde `500` | sem `REVALIDATE_SECRET` o handler é **fail-closed** (não invalida nada e não há default no Compose) | Gere com `openssl rand -hex 32`, coloque no `.env` da raiz e `make restart` |
| Backend demora a responder na primeira subida em DEV | `medusa develop` compila `medusa-config.ts` e sobe o Vite do admin | Espere o healthcheck (o `start_period` do DEV é de 120s); acompanhe com `make logs` |

**Reset completo do ambiente** (apaga banco, Redis e todos os volumes, inclusive os anônimos):

```bash
make clean-db            # pede confirmação; depois suba de novo:
make up && make migrate && make seed
```

---

## 🌐 Endereços de Acesso

| Serviço | URL | Credenciais / Notas |
| :--- | :--- | :--- |
| **Loja Storefront (Next.js)** | [http://localhost:8000](http://localhost:8000) | Vitrine e catálogo nacional (BRL) |
| **Catálogo de Roupas** | [http://localhost:8000/br/store](http://localhost:8000/br/store) | Vestidos, Camisas e Alfaiataria |
| **Painel Admin Medusa v2** | [http://localhost:9000/painel](http://localhost:9000/painel) | **E-mail**: `admin@realvalor.com.br`<br>**Senha**: `admin123456` |
| **Store API** | [http://localhost:9000/store](http://localhost:9000/store) | API REST consumida pelo frontend |
| **Health check** | [http://localhost:9000/health](http://localhost:9000/health) | `200` indica backend operacional |
| **PostgreSQL** | `localhost:5438` | user `real_valor` / db `real_valor_db` (loopback) |
| **Redis** | `localhost:6381` | cache e event bus (loopback) |

---

## ⚠️ Painel admin em `/painel` (e não em `/app`)

O caminho do admin **não pode** ser `/app`, o default do Medusa. O `WORKDIR` do
container do backend também é `/app` (`backend/Dockerfile`) e, em **DEV**, o
plugin do admin emite imports com caminho absoluto (`/app/src/admin/...`).
Como o `base` do Vite é o próprio `admin.path`, o Vite aplica
`stripBase("/app/src/admin/i18n/index.ts", "/app")` → `/src/admin/i18n/index.ts`,
procura esse caminho no disco (que não existe — não há `/src` na raiz do
container) e falha:

```
[vite] Internal server error: Failed to resolve import "/src/admin/i18n/index.ts" from "virtual:medusa/i18n"
```

Sintoma: `GET /app` responde `200` (o HTML é servido), mas o bundle não carrega e
o painel fica em branco / com o overlay de erro do Vite. É por isso que `/health`
e um `curl -I` **não** detectam essa falha. Em **produção** o admin é compilado
pelo rollup (sem o `stripBase` do dev server), então o erro só aparece em DEV.

A correção está em `admin.path` (`backend/medusa-config.ts`), com default
`/painel` e override por `MEDUSA_ADMIN_PATH` (repassado ao container pelo
`environment:` do `docker-compose.yml`). Use qualquer caminho que **não** seja
prefixo de `/app` — `/admin` é proibido pelo próprio Medusa, junto com `/auth` e
`/store`.

Diagnóstico rápido:

```bash
make health      # inclui o HTTP do painel admin (espera 200)
make logs-admin  # falha se o Vite registrou "Failed to resolve import"
```

**Credenciais — valor único:** `admin@realvalor.com.br` / `admin123456`. É o
mesmo valor de `ADMIN_PASSWORD` no `.env` e no `.env.example`, e o mesmo que
valida no endpoint usado pela tela de login:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:9000/auth/user/emailpass \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@realvalor.com.br","password":"admin123456"}'   # espera 200
```

`ADMIN_PASSWORD` só é aplicado na **primeira** criação do usuário: o
`backend/docker-entrypoint.sh` chama `yarn medusa user -e ... -p ...`, que **não**
sobrescreve a senha de um usuário existente (ele registra o usuário como já
existente e segue). Por isso `.env`, `.env.example` e este README mantêm o mesmo
valor — assim a senha documentada é sempre a verdadeira.

