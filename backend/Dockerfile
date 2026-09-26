# =============================================================================
# Real Valor — Backend (Medusa v2): Loja (Store API) + Admin
# =============================================================================
# Build multi-stage. Os estagios `deps`/`builder` carregam as devDependencies
# (necessarias para compilar o admin e o framework); o estagio `runner` leva
# apenas o artefato compilado (`.medusa/server`), reduzindo a imagem final e
# removendo ferramentas de build do ambiente de execucao.
#
# Node 22 alinha com o `.nvmrc` do repositorio. O repo usa Yarn 4.12.0
# (fixado em `.yarnrc.yml` + `packageManager`), portanto o Corepack resolve a
# versao correta sozinho — nao fixamos uma versao divergente aqui.
# =============================================================================

# -----------------------------------------------------------------------------
# Estagio 1: deps — dependencias completas (cacheable)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# `libc6-compat` faz a ponte glibc->musl exigida por binarios pre-compilados.
# python3/make/g++ sao necessarios para modulos nativos (@swc/core, sharp).
RUN apk add --no-cache libc6-compat python3 make g++ git curl

WORKDIR /app

# Corepack lê `packageManager` do package.json (yarn@4.12.0)
RUN corepack enable

# Copia apenas os manifestos para aproveitar o cache de camadas:
# mudar o codigo-fonte nao invalida a instalacao das dependencias.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

RUN yarn install --immutable

# -----------------------------------------------------------------------------
# Estagio 2: builder — compila o backend e o admin
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ git curl

WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY . .

# `medusa build` compila o admin (Vite) para `.medusa/server/public/admin` e
# transpila os modulos para `.medusa/server`. Ele precisa de uma DATABASE_URL
# valida alcancavel durante o build; por isso aceitamos via build-arg.
ARG DATABASE_URL
ARG REDIS_URL
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL

RUN yarn build

# -----------------------------------------------------------------------------
# Estagio 3: runner — imagem final de EXECUCAO em producao
# -----------------------------------------------------------------------------
# Sem devDependencies: apenas o necessario para `yarn start` (medusa start) e
# para as migrations do entrypoint.
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat curl postgresql16-client \
    && addgroup --system --gid 1001 medusa \
    && adduser --system --uid 1001 medusa

WORKDIR /app

# NODE_ENV NAO e fixado aqui de proposito: o overlay de desenvolvimento
# (`docker-compose.override.yml`) precisa de `development` para que o Medusa
# sirva o painel admin a partir do Vite dev server (UI em `/painel`, definida
# em `admin.path` no `backend/medusa-config.ts`). Em producao o
# `docker-compose.yml` define `NODE_ENV=production`, e o `medusa build` compila
# o admin estaticamente. Fixar o valor aqui impediria o overlay de
# sobrescreve-lo via `environment:`.
#
# NAO use `admin.path = "/app"` (o default do Medusa): este WORKDIR tambem e
# "/app" e a coincidencia quebra, em DEV, a resolucao dos modulos de extensao
# do admin (`src/admin/**`) — detalhes em `backend/medusa-config.ts`.
ENV PORT=9000

# Somente o artefato compilado: sem devDependencies, sem ferramentas de build.
COPY --from=builder --chown=medusa:medusa /app/.medusa/server ./

# -----------------------------------------------------------------------------
# Dependencias de PRODUCAO — esta etapa e obrigatoria
# -----------------------------------------------------------------------------
# O `medusa build` gera apenas o bundle da aplicacao (`.medusa/server`); ele
# NAO empacota `node_modules`. Sem dependencias instaladas o container falha ao
# iniciar com "Couldn't find the node_modules state file - running an install
# might help", porque o entrypoint invoca `yarn medusa db:migrate`.
#
# Por isso copiamos o `node_modules` do estagio `builder` (que ja contem a
# arvore completa) e removemos o que so serve ao desenvolvimento. A remocao usa
# o proprio yarn, na MESMA versao do projeto, para nao corromper o estado do
# `install-state.gz` (que precisaria ser reescrito se apagassemos pastas na mao).
COPY --from=builder --chown=medusa:medusa /app/node_modules ./node_modules
COPY --from=builder --chown=medusa:medusa /app/package.json ./package.json
COPY --from=builder --chown=medusa:medusa /app/yarn.lock ./yarn.lock
COPY --from=builder --chown=medusa:medusa /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder --chown=medusa:medusa /app/.yarn ./.yarn

# Remove devDependencies preservando a integridade do estado do Yarn.
# `--production` + `--mode=skip-build` reaproveita o que ja foi compilado e
# invalida apenas os pacotes de desenvolvimento.
RUN corepack enable \
    && yarn workspaces focus --production --all 2>/dev/null \
    || yarn install --production --mode=skip-build

# Entrypoint: aguarda o Postgres, roda migrations sob demanda e cria o admin.
COPY --chown=medusa:medusa docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Executa como usuario nao-root
USER medusa

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -fsS http://localhost:9000/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["yarn", "start"]

# -----------------------------------------------------------------------------
# Estagio 4: dev — imagem para DESENVOLVIMENTO (hot reload)
# -----------------------------------------------------------------------------
# Reaproveita TUDO do estagio `deps`, que inclui as devDependencies. Isso nao e
# opcional: `medusa develop` carrega `medusa-config.ts` e os modulos TypeScript
# do projeto (ex.: `./src/modules/content`) via `ts-node`. Sem as
# devDependencies o boot falha com:
#     ts-node cannot be loaded and used, if you are running in production...
#     Error: Cannot find module 'ts-node'
#     Error in loading config: Cannot find module '/app/src/modules/content'
#
# Por isso o overlay `docker-compose.override.yml` aponta `target: dev`, enquanto
# o `docker-compose.yml` (base) aponta `target: runner` (enxuto). O estagio usado
# esta SEMPRE explicito: sem isso o Compose construiria o estagio default (o
# ultimo do arquivo) e o perfil de execucao nao corresponderia a imagem.
#
# O `node_modules` daqui e preservado do bind mount por um VOLUME ANONIMO
# declarado no compose (`/app/node_modules`), evitando conflito de binarios
# entre host e container.
FROM deps AS dev

RUN apk add --no-cache curl postgresql16-client \
    && addgroup --system --gid 1001 medusa \
    && adduser --system --uid 1001 medusa

WORKDIR /app

# Codigo-fonte: em DEV o compose SOBREPOE com bind mount do host.
COPY --chown=medusa:medusa . .

# Entrypoint: aguarda o Postgres, roda migrations sob demanda e cria o admin.
COPY --chown=medusa:medusa docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Permissoes de ESCRITA do usuario `medusa` em DEV (bug corrigido).
#
# O `COPY --chown` acima da a posse das ENTRADAS copiadas, mas NAO do diretorio
# `/app`: ele foi criado pelo `WORKDIR` do estagio `deps`, que roda como root.
# Como `.medusa` esta no `.dockerignore` (nao pode vir pronto de um `COPY`), o
# admin dev server (Vite) tenta cria-lo em tempo de execucao e o container morre
# com:
#     Error: EACCES: permission denied, mkdir '/app/.medusa'
#     Error starting server: Failed to start admin development server.
# O `node_modules` (tambem criado por root no estagio `deps`) recebe escrita de
# cache do bundler (`node_modules/.vite`, `node_modules/.cache`).
#
# O chown e DELIBERADAMENTE NAO-RECURSIVO: torna os dois diretorios gravaveis
# pelo `medusa` sem reescrever o conteudo. Um `chown -R /app` criaria uma camada
# nova com todo o `node_modules` (~1,4 GB) duplicado so para mudar metadados.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown medusa:medusa /app /app/node_modules

USER medusa

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -fsS http://localhost:9000/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["yarn", "dev"]

