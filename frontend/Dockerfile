# =============================================================================
# Real Valor — Storefront (Catalogo) — Next.js 15 standalone
# =============================================================================
# Build multi-stage. O estagio `runner` usa "standalone output": o Next
# empacota apenas o servidor e as dependencias realmente usadas, gerando uma
# imagem final bem menor que `node_modules` completo.
#
# -----------------------------------------------------------------------------
# O CONTEXTO DE BUILD E A RAIZ DO REPOSITORIO (desde o G5)
# -----------------------------------------------------------------------------
# O contexto deste build NAO e' `./frontend`: e' a RAIZ do repositorio, a mesma
# do backend/Dockerfile. O install e' unico (Yarn workspace) e o storefront
# importa o pacote do contrato (`@rv/contrato`) — os dois vivem fora de
# `./frontend`. O `.dockerignore` que vale e' `/.dockerignore`; o
# `frontend/.dockerignore` morreu junto com o contexto antigo (um
# `.dockerignore` de subdiretorio e' ignorado quando o contexto e' a raiz).
#
# Dentro da imagem a arvore e' a do repositorio:
#     /app            raiz do workspace (package.json, yarn.lock, node_modules)
#     /app/frontend   o app — WORKDIR do build e do dev (`next.config.js`,
#                     `themes/`, `public/`, `src/`)
#     /app/packages   o contrato, resolvido pelo symlink de workspace
#                     (`node_modules/@rv/contrato`); o `transpilePackages` o
#                     compila para dentro dos chunks, entao ele nao e' preciso
#                     em runtime — a saida standalone ja' o contem.
#
# ATENCAO: `NEXT_PUBLIC_*` e INLINADO em tempo de BUILD, nao lido em runtime.
# Trocar NEXT_PUBLIC_MEDUSA_BACKEND_URL exige RECONSTRUIR a imagem — passar
# um novo valor no `environment:` do compose nao tem efeito no bundle.
#
# O BUILD NAO DEPENDE DE BACKEND ALCANCAVEL (corrigido):
# as paginas de categoria/colecao/produto declaravam `generateStaticParams()`,
# que chama a Store API durante o `next build`. Sem backend no ar, o build
# ABORTAVA com "Failed to collect page data for
# /[countryCode]/categories/[...category]" e era preciso anexar o builder a
# `real_valor_net` (opcao `network`, nao suportada pelo BuildKit), usar o
# builder LEGACY e manter `scripts/build-frontend.sh`. Essas chamadas foram
# removidas: as paginas renderizam SOB DEMANDA com ISR (`revalidate` + tag) e o
# cache e invalidado por `/api/revalidate`. `docker compose build frontend`
# roda 100% offline e a ordem de subida dos servicos nao importa.
#
# Node 22 alinha com o `.nvmrc`. Yarn 4.12.0 vem do `packageManager`.
#
# ESTAGIOS: `deps` -> `builder` -> `runner` (producao) | `deps` -> `dev`.
# `docker-compose.yml` fixa `target: runner` e `docker-compose.override.yml`
# fixa `target: dev` — o modo nunca depende do estagio default do Dockerfile.
# =============================================================================

# -----------------------------------------------------------------------------
# Estagio 1: deps — dependencias do WORKSPACE, so' a arvore do storefront
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# `libc6-compat` cobre binarios pre-compilados; python3/make/g++ cobrem os
# modulos nativos que o Next/Tailwind compilam no install.
RUN apk add --no-cache libc6-compat python3 make g++ git

WORKDIR /app

# Corepack lê `packageManager` do package.json (yarn@4.12.0) — o da RAIZ do
# workspace, que desde o G5 e' a unica instalacao.
RUN corepack enable

# Os MANIFESTOS dos membros do workspace: o Yarn resolve o projeto inteiro
# para montar uma arvore, e o lockfile cita os tres.
COPY package.json yarn.lock .yarnrc.yml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/contrato/package.json ./packages/contrato/package.json
COPY .yarn ./.yarn

# `workspaces focus` instala APENAS a arvore do storefront (o backend nao entra
# nesta imagem). O `focus` nao tem `--immutable`: quem confere o lockfile e' o
# `yarn install --immutable` do CI e do host, sobre o MESMO commit.
RUN yarn workspaces focus medusa-next

# -----------------------------------------------------------------------------
# Estagio 2: builder — `next build`
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ git

WORKDIR /app

RUN corepack enable

# As dependencias instaladas no `deps` (o `node_modules` do workspace e o Yarn
# 4 pinado em `.yarn/releases`, que o `yarn build` precisa para rodar).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn

# A arvore do workspace (sem o backend): a raiz, o pacote do contrato e o
# storefront — o `next build` le `frontend/` e resolve `@rv/contrato` pelo
# symlink do workspace, como no repositorio.
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/ ./packages/
COPY frontend/ ./frontend/

# O build roda do APP (onde estao `next.config.js`, `themes/` e `public/`).
WORKDIR /app/frontend

# `next.config.js` executa `checkEnvVariables()`, que chama `process.exit(1)`
# se NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY estiver ausente. Ela precisa existir
# em tempo de BUILD, por isso vem como build-arg.
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION
ARG NEXT_PUBLIC_STRIPE_KEY
# URL INTERNA (container->container) usada pelo SERVIDOR durante o build e o SSR.
# Diferente das NEXT_PUBLIC_*: esta NAO vai para o browser. Como o build nao
# consulta mais a Store API, ela nao e obrigatoria aqui — mas e mantida para que
# o fallback de SSR e o `route.ts` de revalidacao usem o host interno correto.
ARG MEDUSA_BACKEND_URL

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL

# Silencia a telemetria do Next durante builds automatizados.
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# -----------------------------------------------------------------------------
# Estagio 3: runner — imagem final enxuta
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache curl \
    && addgroup --system --gid 1001 nextjs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

# NODE_ENV tambem e definido no compose (producao) para manter explicito.
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

# A saida standalone de um WORKSPACE espelha a RAIZ do projeto (medido):
#
#     standalone/frontend/server.js   o servidor do app
#     standalone/node_modules/        as dependencias tracadas
#     standalone/package.json         a raiz do workspace
#
# Ou seja: a saida JA' E' a arvore de `/app` — e e' para `/app` que ela e'
# copiada, ficando identica ao repositorio. `public/` e `.next/static` NAO sao
# copiados automaticamente e precisam ser trazidos explicitamente, no lugar em
# que o servidor os procura (dentro do app).
#
# O pacote do contrato NAO precisa ser copiado: o `transpilePackages` o compila
# DENTRO dos chunks do servidor (medido — a saida standalone nao tem
# `node_modules/@rv`, e o conteudo padrao aparece em `.next/server/chunks/`).
COPY --from=builder --chown=nextjs:nextjs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/frontend/public ./frontend/public

# `themes/` NAO e copiado para a imagem: desde a R5 a loja le o tema do payload
# (`GET /store/content?surface=theme`, em `src/lib/data/theme.ts`). A unica
# coisa que vem daquela pasta e o `themes/default/theme.json` — o fallback
# embutido —, e o `src/lib/theme.ts` o **importa**, entao ele entra no bundle do
# build: nao precisa existir no runtime. Antes a pasta era copiada por causa de
# um `fs.readdirSync` em request-time, que engolia o erro e fazia a loja cair no
# tema default sem avisar. Ver docs/plano-centralizacao.md, R5.

# Executa como usuario nao-root
USER nextjs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:8000/br || exit 1

# Executa o servidor standalone DIRETAMENTE com node.
#
# Por que nao `yarn start`: a imagem `node:22-alpine` traz o Yarn 1.22.22
# classico, enquanto o projeto exige Yarn 4.12.0 (`packageManager`). Rodar
# `yarn` aqui falharia com:
#     This project's package.json defines "packageManager": "yarn@4.12.0".
#     However the current global version of Yarn is 1.22.22.
# Habilitar o Corepack resolveria, mas seria uma dependencia desnecessaria: o
# `server.js` gerado pelo Next nao precisa de Yarn para rodar — ele so precisa
# de `node` e do `node_modules` que ja esta na imagem.
# O `server.js` mora DENTRO do app (`standalone/frontend/`), porque o tracing
# root de um workspace e' a raiz do projeto: o comando roda de `/app`, como o
# `next start` rodaria do app em desenvolvimento.
CMD ["node", "frontend/server.js"]

# -----------------------------------------------------------------------------
# Estagio 4: dev — imagem para DESENVOLVIMENTO (hot reload)
# -----------------------------------------------------------------------------
# `docker-compose.override.yml` aponta `target: dev` para este estagio.
#
# POR QUE O ESTAGIO `runner` NAO SERVE PARA DEV (bug corrigido):
#   1. `runner` e o output STANDALONE: nao tem devDependencies, nao tem o
#      binario `next` utilizavel, nao tem `src/` nem `next.config.js`;
#   2. `runner` nao tem o Yarn 4 do projeto (so o Yarn 1.22.22 da imagem base),
#      portanto `yarn dev` falharia com o erro de `packageManager` acima.
#   Antes, `docker compose up` (dev) construia o estagio default do Dockerfile
#   — ou seja, o proprio `runner` — e depois tentava rodar `yarn dev` nele.
#   Agora o estagio e explicito nos dois modos (`runner` na base, `dev` no
#   override) e o dev tem uma imagem adequada.
#
# Reaproveita TUDO do estagio `deps` (devDependencies instaladas, Corepack
# habilitado, `libc6-compat`/python3/make/g++ para modulos nativos) e mantem o
# codigo-fonte na imagem, para que o container funcione MESMO SEM bind mount.
#
# NAO roda como usuario nao-root, ao contrario do `runner`: em dev o codigo vem
# por bind mount do host (arquivos com o uid do host) e o Next escreve em
# `.next/`, `node_modules/.cache` etc. Executar como root evita conflito de
# permissao entre host e container — aceitavel porque este estagio NUNCA vai
# para producao.
FROM deps AS dev

WORKDIR /app

# A arvore do workspace (a mesma que o build monta): o pacote do contrato e o
# frontend. O `node_modules` ja' vem do estagio `deps` — nao ha' COPY
# redundante dele aqui (era uma camada de ~1GB duplicada).
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/ ./packages/
COPY frontend/ ./frontend/

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000

# O dev roda do APP, como o build.
WORKDIR /app/frontend

EXPOSE 8000

# `next dev --turbopack -p 8000` (script `dev` do package.json). Os binarios do
# Yarn 4 e do Next vem de `.yarn/releases` + `node_modules`, ja na imagem.
CMD ["yarn", "dev"]
