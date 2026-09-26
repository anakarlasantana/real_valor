# =============================================================================
# Real Valor — Storefront (Catalogo) — Next.js 15 standalone
# =============================================================================
# Build multi-stage. O estagio `runner` usa "standalone output": o Next
# empacota apenas o servidor e as dependencias realmente usadas, gerando uma
# imagem final bem menor que `node_modules` completo.
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
# Estagio 1: deps — dependencias completas (cacheable)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# `libc6-compat` cobre binarios pre-compilados; python3/make/g++ cobrem os
# modulos nativos que o Next/Tailwind compilam no install.
RUN apk add --no-cache libc6-compat python3 make g++ git

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

RUN yarn install --immutable

# -----------------------------------------------------------------------------
# Estagio 2: builder — `next build`
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ git

WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY . .

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

# A saida standalone agrupa o servidor e as dependencias usadas em
# `.next/standalone`. `public/` e `.next/static` NAO sao copiados
# automaticamente e precisam ser trazidos explicitamente.
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# CRITICO: `src/lib/theme.ts` faz `fs.readdirSync(path.join(process.cwd(),
# "themes"))` em RUNTIME. O `standalone` nao inclui essa pasta, e o codigo
# engole o erro silenciosamente (`try/catch`), fazendo a loja cair no tema
# default sem avisar. Portanto `themes/` e copiado explicitamente aqui.
COPY --from=builder --chown=nextjs:nextjs /app/themes ./themes

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
CMD ["node", "server.js"]

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

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000

EXPOSE 8000

# `next dev --turbopack -p 8000` (script `dev` do package.json). Os binarios do
# Yarn 4 e do Next vem de `.yarn/releases` + `node_modules`, ja na imagem.
CMD ["yarn", "dev"]
