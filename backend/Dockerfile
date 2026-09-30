# -----------------------------------------------------------------------------
# O CONTEXTO DE BUILD E A RAIZ DO REPOSITORIO (nao `backend/`) — E O WORKSPACE
# -----------------------------------------------------------------------------
# Este Dockerfile e de um pacote que depende de outro: o CRM (`admin/`, pacote
# IRMAO deste, ver docs/plano-centralizacao.md) e compilado pelo Vite do backend
# (`medusa build` -> `admin.sources` no medusa-config.ts). Um contexto limitado a
# `backend/` nao alcanca o irmao — o Compose declara `context: .` +
# `dockerfile: backend/Dockerfile` nos dois modos, e por isso todo `COPY` daqui
# escreve o caminho a partir da raiz (`COPY backend/ …`).
#
# Desde o G5 (install unico) a imagem reproduz a ARVORE DO REPOSITORIO:
#
#     /app            a raiz do workspace (package.json, yarn.lock, .yarnrc.yml,
#                     node_modules instalado uma vez)
#     /app/backend    o backend: `medusa-config.ts`, `src/`, e o WORKDIR
#     /app/admin      o CRM, IRMAO do backend nessa raiz — a resolucao de import
#                     do Vite/Rollup parte da arvore do arquivo e precisa do
#                     `node_modules` ACIMA da fonte
#     /app/packages   o contrato (`@rv/contrato`), que os dois apps importam
#
# O pacote do contrato aparece para o backend pelo symlink de workspace
# (`/app/node_modules/@rv/contrato -> ../../packages/contrato`), exatamente como
# no repositorio — por isso `/app/packages` tambem entra no estagio final.
# Os `.dockerignore` que valem sao os daquele contexto — `/.dockerignore`.
#
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
# Estagio 1: deps — dependencias do WORKSPACE, so' a arvore do backend
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# `libc6-compat` faz a ponte glibc->musl exigida por binarios pre-compilados.
# python3/make/g++ sao necessarios para modulos nativos (@swc/core, sharp).
RUN apk add --no-cache libc6-compat python3 make g++ git curl

WORKDIR /app

# Corepack lê `packageManager` do package.json (yarn@4.12.0) — o do WORKSPACE,
# que desde o G5 e' o unico.
RUN corepack enable

# Copia apenas os MANIFESTOS dos membros (a raiz + os tres pacotes): o Yarn
# resolve o projeto inteiro para montar uma arvore, e o lockfile cita os tres.
# Mudar o codigo-fonte nao invalida a instalacao.
COPY package.json yarn.lock .yarnrc.yml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/contrato/package.json ./packages/contrato/package.json
COPY .yarn ./.yarn

# `workspaces focus` instala APENAS a arvore do backend — com as
# devDependencies, que o `medusa build` precisa para compilar o admin. O
# storefront (Next) nao entra nesta imagem.
#
# O `focus` nao tem `--immutable`: quem confere que o lockfile esta em dia e' o
# `yarn install --immutable` do CI e do host, sobre o MESMO commit.
RUN yarn workspaces focus real-valor-backend

# -----------------------------------------------------------------------------
# Estagio 2: builder — compila o backend e o admin
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ git curl

WORKDIR /app

RUN corepack enable

# -----------------------------------------------------------------------------
# TS_NODE_IGNORE — o pacote do contrato NAO passa pelo ts-node (G5)
# -----------------------------------------------------------------------------
# `medusa build` carrega `medusa-config.ts` (e o modulo de conteudo, que importa
# o contrato) pelo ts-node, em modo CJS — e o hook CJS do ts-node RECUSA arquivo
# ESM. O contrato e' um pacote ESM (`packages/contrato/package.json` tem
# `type: module`):
#
#     #43 8.393 error:   Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:
#     #43 8.393   /app/packages/contrato/src/schema.ts
#     #43 8.393     at createErrRequireEsm (.../ts-node/dist-raw/...)
#     #43 8.393     at Object.<anonymous> (/app/backend/src/modules/content/schema.ts:12:14)
#
# O caminho REAL do pacote (`/app/packages/contrato/src/*.ts`, via symlink de
# workspace) nao esta' sob `node_modules`, entao o `ignore` padrao do ts-node
# nao o alcanca. Ignorando esse diretorio, quem carrega o arquivo e' o proprio
# Node 22.18+, que faz type-stripping de TypeScript e `require()` de ESM — as
# duas coisas de que o pacote precisa. MEDIDO no container (Node 22.23.3), com e
# sem a variavel: sem ela, ERR_REQUIRE_ESM; com ela, build normal.
#
# ATENCAO ao lugar: este estagio NAO herda o `deps` (e' um `FROM` proprio, que
# copia o `node_modules` de la'), entao o `ENV` tem de estar aqui — e o estagio
# `dev` (que herda do `deps`) repete a linha pelo mesmo motivo. O `runner` nao
# precisa: em producao o `.medusa/server` ja' e' JavaScript.
ENV TS_NODE_IGNORE="/node_modules/|/packages/contrato/"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn

# A arvore do repositorio (sem o storefront): a raiz do workspace, o pacote do
# contrato, o backend e o CRM — cada um no seu lugar (ver o topo do arquivo).
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/ ./packages/
COPY backend/ ./backend/
# O CRM, IRMAO do backend dentro desta raiz (`/app/admin`): e' de la' que o
# `admin.sources` do medusa-config.ts tira a fonte do painel.
COPY admin/ ./admin/

# `medusa build` roda do diretorio do APP, como no repositorio: e' de
# `/app/backend` que ele le `medusa-config.ts` e escreve `.medusa/server`.
WORKDIR /app/backend

# `medusa build` compila o admin (Vite) para `.medusa/server/public/admin` e
# transpila os modulos para `.medusa/server`. Ele precisa de uma DATABASE_URL
# valida alcancavel durante o build; por isso aceitamos via build-arg.
ARG DATABASE_URL
ARG REDIS_URL
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL

RUN yarn build

# -----------------------------------------------------------------------------
# Enxuga o `node_modules` AQUI, e nao no estagio `runner`
# -----------------------------------------------------------------------------
# `--production` tira as devDependencies (vite, ts-node, jest…) preservando o
# estado do Yarn. Fica neste estagio porque o cache do Yarn esta' aqui
# (`.yarn/cache`, vindo do `deps`): o `focus --production` roda SEM REDE. O
# `runner` copia a arvore ja' enxuta e apenas o `.yarn/releases`, entao o cache
# de ~145MB nao entra na imagem final.
WORKDIR /app
RUN yarn workspaces focus --production real-valor-backend

# -----------------------------------------------------------------------------
# Estagio 3: runner — imagem final de EXECUCAO em producao
# -----------------------------------------------------------------------------
# Sem devDependencies: apenas o necessario para `yarn start` (medusa start) e
# para as migrations do entrypoint.
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat curl postgresql16-client \
    && addgroup --system --gid 1001 medusa \
    && adduser --system --uid 1001 medusa

# O WORKDIR comeca na RAIZ do workspace porque e' de la' que vem o
# `node_modules`; no fim do estagio ele desce para `/app/backend`, o diretorio
# do app (o mesmo de onde o `medusa build` compilou).
WORKDIR /app

# NODE_ENV NAO e fixado aqui de proposito: o overlay de desenvolvimento
# (`docker-compose.override.yml`) precisa de `development` para que o Medusa
# sirva o painel admin a partir do Vite dev server (UI em `/painel`, definida
# em `admin.path` no `backend/medusa-config.ts`). Em producao o
# `docker-compose.yml` define `NODE_ENV=production`, e o `medusa build` compila
# o admin estaticamente. Fixar o valor aqui impediria o overlay de
# sobrescreve-lo via `environment:`.
ENV PORT=9000

# A RAIZ do workspace: o manifesto que traz o `packageManager`, o lockfile, o
# Yarn 4 (`.yarnrc.yml` + `.yarn/releases`, que valem para os dois apps) e o
# `node_modules` ja' SEM devDependencies. O enxugamento acontece no `builder`
# (que tem o cache do Yarn): aqui nao ha' mais `focus`, e o cache de ~145MB
# fica fora da imagem.
COPY --from=builder --chown=medusa:medusa /app/node_modules ./node_modules
COPY --from=builder --chown=medusa:medusa /app/package.json ./package.json
COPY --from=builder --chown=medusa:medusa /app/yarn.lock ./yarn.lock
COPY --from=builder --chown=medusa:medusa /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder --chown=medusa:medusa /app/.yarn/releases ./.yarn/releases

# O contrato continua no lugar de sempre: o symlink de workspace
# (`node_modules/@rv/contrato -> ../../packages/contrato`) aponta para ca'.
# Nao e' opcional — o codigo compilado pode resolver `@rv/contrato` em runtime.
COPY --from=builder --chown=medusa:medusa /app/packages ./packages

# Somente o artefato compilado, em `/app/backend`: o `.medusa/server` traz o
# `medusa-config.js`, as rotas, os modulos e o admin compilado (`public/admin`).
COPY --from=builder --chown=medusa:medusa /app/backend/.medusa/server ./backend
COPY --from=builder --chown=medusa:medusa /app/backend/package.json ./backend/package.json

# Pasta de uploads do painel — a MESMA que o Medusa serve em `/static/...`
# (ver `@medusajs/file-local` no medusa-config.ts, cujo `upload_dir` e' o
# `static` RELATIVO ao diretorio do app). Ela precisa existir na IMAGEM com o
# dono certo: o volume nomeado `real_valor_uploads` do compose monta aqui e
# nasce copiando conteudo e permissao deste caminho — um volume montado sobre
# caminho inexistente fica com dono `root`, e a aplicacao roda como `medusa`.
RUN mkdir -p /app/backend/static && chown medusa:medusa /app/backend/static

# Entrypoint: aguarda o Postgres, roda migrations sob demanda e cria o admin.
COPY --chown=medusa:medusa backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# O comando roda do APP (`yarn start` = `medusa start`, do entrypoint): e' de
# `/app/backend` que o Yarn acha o projeto e que o Medusa le o
# `medusa-config.js` compilado. O `.yarnrc.yml`, o `.yarn/releases` e o
# `node_modules` sao da raiz, um nivel acima — e' assim que o workspace roda.
WORKDIR /app/backend

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

# Ver o `builder`: o ts-node (aqui pelo `medusa develop`) recusa o pacote ESM do
# contrato, e o `ignore` padrao dele nao alcanca `/app/packages/contrato`. Este
# estagio herda do `deps` — e nao do `builder` —, entao a linha se repete aqui.
ENV TS_NODE_IGNORE="/node_modules/|/packages/contrato/"

# A arvore do WORKSPACE, igual a da imagem de producao (ver o topo do arquivo):
# a raiz (`package.json` + `yarn.lock` + `.yarnrc.yml`), o pacote do contrato, o
# backend e o CRM — cada um no seu lugar. O `node_modules` ja' vem do `deps`.
#
# CUIDADO: `COPY backend/ ./backend/` (e NAO `COPY backend/ .`) — a raiz de
# `/app` e' a do WORKSPACE desde o G5. Copiar o backend para ela sobrescreve o
# `package.json` da raiz pelo do app, e o Yarn passa a ver o diretorio do app
# como o projeto inteiro:
#     Internal Error: Package for real-valor-backend@workspace:. not found in the project
# Medido (era o `COPY backend/ .` da versao anterior deste estagio).
COPY --chown=medusa:medusa package.json yarn.lock .yarnrc.yml ./
COPY --chown=medusa:medusa packages/ ./packages/
COPY --chown=medusa:medusa backend/ ./backend/
# O CRM, IRMAO do backend dentro desta raiz: em DEV o override monta `./admin`
# aqui (`/app/admin`), e e' de la' que o `admin.sources` do medusa-config.ts
# tira a fonte do painel. Dentro de `/app` de proposito: a resolucao de import
# do Vite/Rollup parte da arvore do arquivo e precisa do `node_modules` ACIMA
# dela.
COPY --chown=medusa:medusa admin/ ./admin/

# Entrypoint: aguarda o Postgres, roda migrations sob demanda e cria o admin.
COPY --chown=medusa:medusa backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Permissoes de ESCRITA do usuario `medusa` em DEV (bug corrigido).
#
# O `COPY --chown` acima da a posse das ENTRADAS copiadas, mas NAO dos
# diretorios que as contem: `/app` e `/app/backend` foram criados pelo `WORKDIR`
# /`COPY` dos estagios anteriores, que rodam como root. Como `.medusa` esta no
# `.dockerignore` (nao pode vir pronto de um `COPY`), o admin dev server (Vite)
# tenta cria-lo em tempo de execucao e o container morre com:
#     Error: EACCES: permission denied, mkdir '/app/backend/.medusa'
#     Error starting server: Failed to start admin development server.
# O `node_modules` (tambem criado por root no estagio `deps`) recebe escrita de
# cache do bundler (`node_modules/.vite`, `node_modules/.cache`).
#
# O chown e DELIBERADAMENTE NAO-RECURSIVO: torna esses diretorios gravaveis pelo
# `medusa` sem reescrever o conteudo. Um `chown -R /app` criaria uma camada nova
# com todo o `node_modules` (~1,4 GB) duplicado so para mudar metadados.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown medusa:medusa /app /app/backend /app/admin /app/packages /app/node_modules

# Mesma pasta do estagio `runner` (ver comentario la): em DEV o overlay monta o
# volume `real_valor_uploads` sobre ela.
RUN mkdir -p /app/backend/static && chown medusa:medusa /app/backend/static

# O comando roda do APP, como no `runner`.
WORKDIR /app/backend

USER medusa

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -fsS http://localhost:9000/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["yarn", "dev"]

