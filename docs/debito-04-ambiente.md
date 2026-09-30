<!--
  Parte 4 do registro de débito técnico (item 6 e a ordem de ataque).
  Entrada, legenda de severidade e mapa dos assuntos: `docs/DEBITO-TECNICO.md`.
-->

# 6. ⚠️ Armadilhas de ambiente Docker (não são débitos, são pré-requisitos)

Registrado aqui porque cada item **custou tempo de diagnóstico** e o sintoma não aponta para a
causa. Todos foram resolvidos entre 2026-09-24 (containerização) e 2026-09-26 (build hermético e
modelo único de Compose).

### 6.1 SSL forçado pelo Medusa contra um Postgres sem TLS

**Sintoma:** migrations falham com
`Could not connect to the database while running migrations. The connection timed out after 10
seconds, which usually indicates an incorrect database URL or an SSL configuration issue.`

A mensagem é **enganosa**: a `DATABASE_URL` está correta e o banco aceita conexões (confirmado
com `psql` e com o driver `pg` cru). O erro real é de TLS.

**Causa:** `getDefaultDriverOptions` (`@medusajs/utils/dist/modules-sdk/load-module-database-config.js`)
escolhe as opções de driver por *string matching* na URL:

```js
clientUrl.match(/localhost|127\.0\.0\.1|ssl_mode=(disable|false)|sslmode=(disable)/i)
  ? { connection: { ssl: false } }                 // local
  : { connection: { ssl: { rejectUnauthorized: false } } }  // remoto
```

Dentro do Docker o host é o **nome do serviço** (`postgres`), que não casa com `localhost`.
O Medusa então assume um banco gerenciado remoto e tenta um handshake TLS contra um Postgres com
`ssl = off`. O handshake **não falha, fica pendurado**, e estoura o timeout de 10s
(`MEDUSA_DB_MIGRATION_CONNECTION_TIMEOUT`) do verificador de migrations.

**Solução:** acrescentar `?sslmode=disable` à `DATABASE_URL`. É o escape hatch que o próprio
Medusa reconhece para forçar `ssl: false`. Está aplicado no `docker-compose.yml` (fallback da
`DATABASE_URL`) e documentado no `.env.example`.

> **Não remova o `?sslmode=disable`.** Se um dia o banco for realmente remoto com TLS, troque por
> `?sslmode=require` — mas nunca deixe a URL sem o parâmetro.

### 6.2 `medusa build` não empacota `node_modules`

O artefato gerado em `.medusa/server` contém **apenas o bundle da aplicação**, sem dependências.
Uma imagem `runner` que copie só `.medusa/server` + manifestos falha ao iniciar com:

```
Usage Error: Couldn't find the node_modules state file - running an install might help
```

porque `docker-entrypoint.sh` invoca `yarn medusa db:migrate`. Por isso o
`backend/Dockerfile` copia o `node_modules` do estágio `builder` — que desde o G5 já sai
**enxugado** de lá, por `yarn workspaces focus --production real-valor-backend` rodado no
`builder` e não no `runner`: é no builder que o cache do Yarn está (o `focus` roda **sem
rede**), e o `runner` copia a árvore pronta mais apenas o `.yarn/releases` — o cache de
~145MB deixa de entrar na imagem final. Usar o próprio Yarn preserva o estado do install
(`node_modules/.yarn-state.yml`); apagar pastas à mão corromperia o estado.

### 6.3 O build do storefront exigia o backend no ar — **RESOLVIDO em 2026-09-26**

**Sintoma (histórico):** `next build` abortava com *"Failed to collect page data"* /
`ECONNREFUSED` quando nenhum backend escutava em `http://localhost:9000`. Isso tornava a ordem de
subida obrigatória e **impedia um build offline** (`docker compose build` sem a stack no ar).

**Causa:** `generateStaticParams()` em
`frontend/src/app/[countryCode]/(main)/categories/[...category]/page.tsx` (e nas páginas de
coleção/produto equivalentes) consultava a **Store API em tempo de build**. Dentro do Docker isso
exigia o builder anexado à rede `real_valor_net` (ver 6.5).

**Correção:** `generateStaticParams()` foi **removido** dessas rotas. Elas renderizam **sob
demanda** com ISR (`revalidate` + `tag`), e a invalidação passou a ser sob demanda por
`POST /api/revalidate` (`make revalidate TAG=products`). Consequências verificadas:

1. `docker compose build` funciona **100% offline** — comprovado com
   `HTTP_PROXY=HTTPS_PROXY=http://127.0.0.1:9 npx next build` (proxy morto: qualquer tentativa de
   rede durante o build falha imediatamente).
2. A ordem de subida deixou de importar; as dependências reais são resolvidas por `depends_on` +
   `healthcheck`.
3. `start.sh`, a espera por `/health` antes do build e o `scripts/build-frontend.sh` deixaram de
   existir — nenhum deles tem razão de ser agora.

### 6.4 `NEXT_PUBLIC_*` é inlinado em tempo de build

Alterar `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`,
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_STRIPE_KEY` **exige reconstruir a imagem** do
frontend. Definir apenas no `environment:` do compose não altera o JS entregue ao navegador.

### 6.5 BuildKit ignora `build.network` — **OBSOLETO desde 2026-09-26**

Era o bloqueio que forçava o *builder legacy*: como o build do storefront alcançava o backend
(6.3), o caminho natural seria anexar o builder à rede com `build.network: real_valor_net`, mas o
**BuildKit não suporta** essa opção em builds do Compose:

```
network mode "real_valor_net" not supported by buildkit - you can define a custom network for
your builder using the network driver-opt in buildx create
```

Como o Docker Desktop e o Docker Engine modernos usam BuildKit por padrão, era preciso forçar o
builder antigo (`DOCKER_BUILDKIT=0`) e o `scripts/build-frontend.sh` encapsulava isso.

**Por que deixou de existir:** o `next build` não faz mais nenhuma chamada de rede (6.3), logo não
precisa de rede nenhuma — nem `build.network`, nem builder legacy, nem script auxiliar. O caminho
normal passou a ser `docker compose build` (ou `make build`), com BuildKit, sem flags de ambiente:

Alternativas descartadas na época (registradas para não serem reabertas): criar um builder buildx
dedicado com `driver-opt network=` exigia configuração manual da máquina (não reprodutível por
`git clone`), e expor o backend via `host.docker.internal` quebrava a premissa de que o build roda
na rede interna. Todas ficaram irrelevantes: o problema era **dependência de rede no build**, e a
solução foi removê-la, não acomodá-la.

### 6.6 `/health` e nativo do Medusa v2 (mas não do storefront)

O backend expõe `GET /health` **nativamente** (`@medusajs/medusa/dist/commands/start.js`
registra a rota, respondendo `200 OK` com corpo `OK`). Não é uma rota deste projeto — existem
rotas de projeto em `backend/src/api/store/*`, mas nenhuma em `/health`. O `HEALTHCHECK` do
`backend/Dockerfile`, o `depends_on: condition: service_healthy` do frontend e o alvo `make health`
dependem dela (não há mais espera manual em `start.sh`).

O **storefront não tem** `/health` (retorna 404, pois só existem as rotas do App Router em
`frontend/src/app`). Por isso o `HEALTHCHECK` do `frontend/Dockerfile` e o `make health` validam a
home `/br`, que é a página que prova o caminho completo (SSR → Store API → banco).

### 6.7 `next/font/google` baixa as fontes durante o build — **RESOLVIDO em 2026-09-26**

**Sintoma:** falha **intermitente** de `next build` (e, portanto, de `docker compose build`) no
`layout.tsx`:

```
Module not found: Can't resolve '@next/font/google' ... / url(...) failed to parse
```

Intermitente porque só ocorre quando a resposta de `fonts.googleapis.com` chega **truncada** — o
CSS vem com HTTP `200` e termina no meio de uma `url()`, e o Next tenta interpretar esse fragmento
como URL (`/^url\((.+)\)$/` → falha). Sem repetir a requisição, o build morre; com rede estável o
mesmo commit passa. É a pior classe de falha: **não determinística e não explicada pelo código**.

**Causa:** `next/font/google` resolve e baixa as famílias **em tempo de build**, a partir da rede.
Ou seja, o build não era hermético — dependia de terceiros e da qualidade do link, exatamente o que
6.3 havia acabado de eliminar do lado da Store API.

**Correção:** as três famílias usadas pela marca passaram a ser **self-hosted** com
`next/font/local`, a partir de arquivos versionados no repositório:

| Família | Arquivo | Pesos declarados | Tipo |
|---|---|---|---|
| Playfair Display | `frontend/src/app/fonts/playfair-display/playfair-display-latin.woff2` | `400`, `700` | variável (`wght 400–900`) |
| Montserrat | `frontend/src/app/fonts/montserrat/montserrat-latin.woff2` | `300`, `700` | variável (`wght 100–900`) |
| Allura | `frontend/src/app/fonts/allura/allura-latin.woff2` | `400` | **estática** (`usWeightClass 400`) |

Os arquivos são subconjuntos **latin** (~100 KB no total, três arquivos), com a licença `OFL.txt`
ao lado de cada um. Nenhuma requisição a `fonts.gstatic.com` ou `fonts.googleapis.com` sai do
build, e não há mais `<link>` para terceiros no HTML servido.

**Verificação (critério de aceite):**

```bash
cd frontend
HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 npx next build   # proxy morto
grep -rl gstatic .next/static/css/ || echo "nenhuma referencia a gstatic"
ls .next/static/media/*.woff2                                                  # 3 fontes emitidas
```

Com `next/font/google` este comando **falha** — é essa a prova de que a dependência existia e
deixou de existir.

**Regenerar/atualizar uma fonte:** `node scripts/vendor-fonts.mjs` (script único, offline depois do
download). Ele usa o `fontkit` empacotado do próprio Next como oráculo para validar cada arquivo —
se a família é variável, confere o eixo `wght`; se é estática, confere `OS/2.usWeightClass` — em vez
de um parser de WOFF2 escrito à mão (que era frágil e não detectava justamente a diferença
estática/variável). Detalhes e justificativa em `frontend/src/app/fonts/README.md`.

---

## Ordem sugerida de ataque

1. **1.3** — segredos: trocar os defaults fracos dos fallbacks do compose antes de qualquer uso
   fora de `localhost`. (`1.2` — CORS — **saiu desta lista em 2026-09-26**; era pré-requisito para
   testar a stack containerizada e já está fechado.)
2. **2.1 + 2.2** — navegação quebrada. Barato e de alto impacto visível.
3. **2.5.4 + 2.5.1** — destravar o CMS: upload de imagem e curadoria de destaque. É o que
   transforma o CMS em ferramenta utilizável pelo lojista.
4. **1.1 + 2.4** — fechar a venda de verdade (exige decisão do provider de pagamento).
5. **2.3 + 2.5.3 + 3.3** — institucional via CMS (depende de conteúdo do cliente).
6. **2.5.2 + 2.5.5** — links das coleções e seed de conteúdo. Itens pequenos e independentes.
7. **3.2** — CI, para travar regressão do que já está pronto. (O `3.4` — documentação — foi
   fechado em 2026-09-26; o `README.md` e este arquivo refletem o modelo único de Compose.)
8. **3.1** — invalidação imediata do CMS.
9. **4.x** — SEO, busca e imagens.
