# Débito Técnico — Real Valor

Registro dos débitos técnicos conhecidos, priorizados por severidade. Cada item traz
**evidência** (arquivo/linha ou comando de verificação) e **impacto**, para que possa ser
atacado sem redescobrir o contexto.

> Última atualização: 2026-09-26
> Escopo auditado: fase CMS (Etapas 2+3+4) concluída e validada, mais a varredura de 2026-09-26
> (**build hermético do storefront** — fonts self-hosted — **consolidação do Compose em um único
> modelo** e a **migração do rodapé para o CMS**, bloco `footer` com colunas e redes sociais). Os
> itens abaixo são o que **fica pendente** para uso em produção.

**Legenda de severidade**

| Nível | Significado |
|---|---|
| 🔴 **Bloqueador** | Impede vender / derruba ambiente. Corrigir antes de qualquer go-live. |
| 🟠 **Alto** | Quebra jornada visível do usuário ou expõe falha de segurança. |
| 🟡 **Médio** | Funciona, mas com atrito operacional ou risco de regressão silenciosa. |
| 🔵 **Baixo** | Polimento, SEO, qualidade de código. |

---

## Índice

- [1. 🔴 Bloqueadores de produção](#1--bloqueadores-de-produção)
  - [1.1 Pagamento real ausente](#11-pagamento-real-ausente)
  - [1.2 CORS bloqueia o storefront (`:8000`) — resolvido](#12-cors-bloqueia-o-storefront-8000)
  - [1.3 Segredos com default fraco e versionado](#13-segredos-com-default-fraco-e-versionado)
- [2. 🟠 Alto](#2--alto)
  - [2.1 `/br/collections` retorna 404](#21-brcollections-retorna-404)
  - [2.2 Links de navegação provisórios — resolvido](#22-links-de-navegação-provisórios)
  - [2.3 Páginas institucionais ausentes](#23-páginas-institucionais-ausentes)
  - [2.4 CPF não é coletado no checkout](#24-cpf-não-é-coletado-no-checkout)
  - [2.5 CMS: elo entre Admin e vitrine incompleto](#25-cms-elo-entre-admin-e-vitrine-incompleto)
  - [2.6 Tailwind descarta a opacidade em cor que é variável](#26-tailwind-descarta-a-opacidade-em-cor-que-é-variável--texto-do-hero-e-dos-cards-herda-a-cor-errada)
- [3. 🟡 Médio](#3--médio)
  - [3.1 CMS sem invalidação imediata de cache](#31-cms-sem-invalidação-imediata-de-cache)
  - [3.2 Zero testes automatizados e zero CI](#32-zero-testes-automatizados-e-zero-ci)
  - [3.3 CMS cobre apenas a superfície `home`](#33-cms-cobre-apenas-a-superfície-home)
  - [3.4 `README.md` desatualizado](#34-readmemd-desatualizado)
  - [3.5 Admin não é servido em modo dev](#35-admin-não-é-servido-em-modo-dev)
- [4. 🔵 Baixo](#4--baixo)
  - [4.1 Sem `sitemap.ts` / `robots.ts`](#41-sem-sitemapts--robotsts)
  - [4.2 Rota `/search` inexistente](#42-rota-search-inexistente)
  - [4.3 Imagens hero em baixa resolução](#43-imagens-hero-em-baixa-resolução)
- [5. Itens verificados e já cobertos](#5-itens-verificados-e-já-cobertos)
- [Ordem sugerida de ataque](#ordem-sugerida-de-ataque)

---

## 1. 🔴 Bloqueadores de produção

### 1.1 Pagamento real ausente

**Evidência:** `backend/src/scripts/seed.ts:131`

```ts
payment_providers: ["pp_system_default"],
```

O seed registra apenas o provider `pp_system_default` (o *system default* do Medusa).
Dependendo da configuração do módulo de payment, isso faz o pedido ser marcado como pago
**sem cobrança real** — ou seja, é possível "fechar" um pedido sem que nenhum valor seja
capturado.

**Agravante:** as opções de frete no mesmo seed são `price_type: "flat"` com valor fixo
(`seed.ts:235-300`): PAC R$ 19,90 e SEDEX R$ 34,90, independente de CEP, peso ou dimensão.

**Ação necessária:**

1. Escolher provider (Mercado Pago — Pix/boleto/cartão BR — vs Stripe).
2. Configurar credenciais e registrar o provider no módulo de payment do
   `backend/medusa-config.ts` (hoje o array de módulos não inclui payment).
3. Criar fluxo de webhook para confirmação assíncrona (Pix/boleto só confirmam depois).
4. Substituir o flat rate por cálculo real (Correios/transportadora) ou aceitar o flat
   conscientemente como política comercial.

> **Decisão pendente do stakeholder:** provider de pagamento. Sem isso não há como planejar
> a execução deste item.

---

### 1.2 CORS bloqueia o storefront (`:8000`)

**Status: resolvido em 2026-09-26.**

**Evidência do problema (histórico):** `.env.example` e os fallbacks do `docker-compose.yml`
traziam as portas padrão do template Medusa, não as do projeto:

```bash
STORE_CORS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_CORS=http://localhost:9000,http://localhost:5173,...
AUTH_CORS=http://localhost:3000,http://localhost:9000,http://localhost:5173,...
```

**Impacto (histórico):** o browser do storefront em `:8000` era bloqueado por CORS ao chamar a
Store API, e login/registro (`/auth/*`) falhava por `AUTH_CORS`. As portas reais do projeto são
`9000` (backend + admin) e `8000` (storefront).

**Correção verificada:**

| Onde | Estado |
|---|---|
| `.env.example:88-90` | `STORE_CORS`/`AUTH_CORS` com `:8000`; `3000`/`5173` removidos |
| `docker-compose.yml:138-140` | fallbacks `${STORE_CORS:-http://localhost:8000,...}` alinhados |
| serviço `frontend` no compose | existe e publica `:8000` — não há mais subida manual do front |

> **Armadilha restante (operação, não código):** o `.env` da raiz **sobrescreve** esses fallbacks.
> Um `.env` criado antes desta correção continua com `:3000` e reintroduz o bloqueio mesmo com o
> compose correto. Recrie-o com `cp .env.example .env`. Isso foi observado e corrigido no `.env`
> local durante a varredura de 2026-09-26.

---

### 1.3 Segredos com default fraco e versionado

**Evidência:** `docker-compose.yml:54-55`

```yaml
JWT_SECRET: ${JWT_SECRET:-real_valor_jwt_secret_key_medusa_v2_2026}
COOKIE_SECRET: ${COOKIE_SECRET:-real_valor_cookie_secret_key_medusa_v2_2026}
```

O valor inseguro é o **fallback** (`:-`): se a variável não for definida no ambiente, o
serviço sobe silenciosamente com um segredo público e conhecido.

**Verificado — sub-item que NÃO se aplica:** o `.env` **não está versionado**; já consta no
`.gitignore`. O que está versionado são apenas templates sem segredo real: `.env.example` e
`frontend/.env.template`.

> Os antigos `backend/.env.docker`, `backend/.env.template` e `backend/.env.test` foram
> **removidos** na consolidação de 2026-09-26: com um único `.env` na raiz lido automaticamente
> pelo Compose (sem `--env-file`, sem `env_file:`), manter três templates no backend era a origem
> direta da divergência de CORS descrita em 1.2.

**Impacto:** em deploy onde o `JWT_SECRET` não for exportado, o fallback permite forjar
sessões — inclusive de admin — reproduzindo o valor público do compose.

**Ação necessária:**

1. Substituir `${JWT_SECRET:-...}` por `${JWT_SECRET:?JWT_SECRET é obrigatório}` para falhar
   no boot em vez de usar default.
2. Rotacionar os segredos atuais e injetá-los via *secret manager* / variáveis de ambiente
   do host (nunca valores literais no compose).
3. Aplicar o mesmo padrão ao `COOKIE_SECRET` e às credenciais de banco.

---

## 2. 🟠 Alto

### 2.1 `/br/collections` retorna 404

**Evidência:** existe apenas a rota dinâmica de detalhe

```
frontend/src/app/[countryCode]/(main)/collections/[handle]/page.tsx
```

**Comprovado agora:**

```
$ curl -o /dev/null -w '%{http_code}' http://localhost:8000/br/collections
404
$ curl -o /dev/null -w '%{http_code}' http://localhost:8000/br
200
```

Falta o `page.tsx` de índice da pasta `collections/`. Até 2026-09-26 o cabeçalho era a
vitrine dessa 404: o link "Coleções" apontava para `/collections` (`nav/index.tsx:24`). Com o
cabeçalho no CMS (item 2.2) o destino padrão virou a âncora da home (`/#collections`), então a
rota ficou órfã — alcançável só por URL digitada, já que o rodapé e o card de produto linkam
por handle (`/collections/<handle>`).

**Ação necessária:** criar `frontend/src/app/[countryCode]/(main)/collections/page.tsx`
listando as coleções via `listCollections` (`frontend/src/lib/data/collections.ts`, já
existente e já utilizado pelo rodapé).

---

### 2.2 Links de navegação provisórios — resolvido

**Status: resolvido em 2026-09-26.** O cabeçalho deixou de ser código: os itens vêm do bloco
`nav` do CMS (`id: nav`, `surface: home`) e são editáveis no admin em **Conteúdo da vitrine**,
sem deploy. `NAV_LINKS` e `SideMenuItems` foram removidos (`grep` retorna zero ocorrências);
`nav/index.tsx` e `side-menu/index.tsx` consomem `HeaderLink[]` / `HeaderAction[]`.

Destinos padrão — espelhados no seed (`backend/src/modules/content/defaults.ts`) e no fallback
do storefront (`frontend/src/lib/content/home-sections.ts`):

| Rótulo | `href` padrão | Comportamento |
|---|---|---|
| Início | `/#hero` | rola até a seção `hero` da home |
| Coleções | `/#collections` | rola até a seção `collections` |
| Produtos | `/store` | vitrine (página real) |
| Sobre | `/#editorial` | rola até a seção `editorial` |
| Contatos | `mailto:contato@realvalor.com.br` | abre o cliente de e-mail |

O `href` **define** o comportamento — não existe campo "modo": `#id`/`/#id` rola, `/rota` é
interno, `https://` abre em nova aba e `mailto:`/`tel:` vai para o handler do sistema.

A âncora entrega de verdade: cada seção da home vira um alvo de `id` no registro de seções
(`(main)/page.tsx`, `div[id={section.id}]` + `.rv-anchor` em `brand.css` para o topo não ficar sob
o cabeçalho fixo). "Sobre" é o caso canônico — o bloco `editorial` é rotulado **Sobre** no admin
desde 2026-09-26 (ver §5).

**O que resta:** o *destino* dos itens de conteúdo. "Sobre" aponta para a seção editorial e
"Contatos" para um `mailto:` — os dois funcionam e são editáveis, mas continuam sendo desvios
enquanto as páginas institucionais do item 2.3 não existirem. A troca é edição no admin, não
deploy.

---

### 2.3 Páginas institucionais ausentes

Não existem páginas para: **Sobre**, **Contato**, **Trocas e Devoluções**, **Política de
Privacidade**, **Termos de Uso** e **Guia de Tamanhos**.

**Impacto:** loja de vestuário sem guia de tamanhos e sem política de trocas gera abandono de
carrinho e pós-venda problemático; privacidade e termos são exigência legal (LGPD) e requisito
de gateways de pagamento. Bloqueia aprovação em alguns meios de pagamento.

**Ação necessária:** criar as rotas institucionais e, preferencialmente, torná-las editáveis
via CMS — o módulo `content` já suporta `surface` e `type`, bastando adicionar
`surface: "institutional"`. Ver também item 3.3.

---

### 2.4 CPF não é coletado no checkout

**Evidência:**

- O backend **já espera** o CPF:
  - `backend/src/subscribers/order-customer-indexer.ts` lê `metadata.cpf` para catalogar o cliente;
  - `backend/src/api/store/orders/track/route.ts` exige `cpf` ou `email` para rastreio;
  - `backend/src/api/store/custom/checkout-info/route.ts` declara `accepted_documents: ["CPF"]`.
- **Nenhuma ocorrência de `cpf` no frontend** (busca em `frontend/src` sem resultados).

**Impacto:** o fluxo de rastreio de pedido *passwordless* prometido no README não funciona na
prática — o cliente não tem onde informar o CPF, então o pedido é salvo sem `metadata.cpf` e o
índice de clientes fica incompleto.

**Ação necessária:** adicionar campo CPF no formulário de checkout, com máscara e validação de
dígito verificador, persistindo em `metadata.cpf` do pedido/cliente.

---

### 2.5 CMS: elo entre Admin e vitrine incompleto

O módulo de conteúdo funciona ponta a ponta — o lojista edita em **Conteúdo da vitrine**
(sidebar principal do admin, `/painel/content`) e a mudança **chega** na home. Mas a
integração tem cinco lacunas que limitam o que é possível editar hoje.

#### 2.5.1 `featured` ("Peças em destaque") não é editável — destaque vem por acaso

**Evidência:** `frontend/src/modules/home/components/featured-products/index.tsx` busca os
produtos com `limit: 8` e **nenhum filtro**; o contrato (`contract.ts:82-90`) só tem
`eyebrow`, `title`, `subtitle`, `filters` (rótulos de chip) e `viewAllLabel`.

**Verificado:** `grep -E 'productId|collectionId|productIds|categoryId' contract.ts` →
**nenhum resultado**. O CMS não tem vínculo com nenhuma entidade comercial do Medusa.

**Impacto:** o lojista controla o *texto* da vitrine de destaque, mas **não quais peças
aparecem**. As 8 mostradas são as 8 primeiras que a Store API devolver, sem curadoria —
uma peça encalhada entra no lugar de uma vitrine, e não há como destacar a peça do momento.

**Ação necessária:** adicionar campo de curadoria (`productIds` / `collectionId`) ao
`FeaturedSection`, com seletor de produtos no admin e a query do front respeitando a seleção.
Requer migration leve (o formato é JSON, então `data` já comporta os IDs).

#### 2.5.2 Links das coleções em destaque apontam todos para o mesmo lugar

**Evidência:** `backend/src/modules/content/defaults.ts:82,90,98` — os três cards "Nossas
coleções" têm `href: "/store"`.

**Impacto:** os três cards do CMS são editáveis em título, imagem e ordem, mas **todos levam ao
mesmo destino**. O card é visual, não navegacional — a expectativa natural do lojista (e do
visitante) é que cada card abra a sua coleção.

**Ação necessária:** trocar o campo `href` por um seletor de coleção (ou preencher os hrefs com
`/collections/<handle>` reais). Combinado com 2.1: `/br/collections` hoje retorna **404**
(reconfirmado via `curl`), então apontar os cards para lá só trocaria um destino genérico por um
destino quebrado. **Corrigir 2.1 antes.**

#### 2.5.3 Apenas a superfície `home` é renderizada — rodapé resolvido

**Status: o rodapé entrou no CMS em 2026-09-26; resta a superfície institucional.**

**Evidência:** todos os blocos têm `surface: "home"` (`seed-content.ts:26`) — inclusive o `nav` e
o `footer`, que não são seções da home e quem os renderiza é o layout. Só
`app/[countryCode]/(main)/page.tsx` consome `getHomeSections()` como corpo de página; as partes
de cromo saem do mesmo payload via `headerSections()` / `footerSections()`. O rodapé agora é o
bloco `footer` (colunas de links — cada uma escolhendo a origem dos itens, catálogo ou digitados —,
e redes sociais, tudo editável em **Conteúdo da vitrine**); o que continua fora do CMS é a
superfície institucional — não há rota nem bloco para Sobre/Contato.

**Impacto:** o alcance do CMS é a home e o cromo (barra de anúncio, cabeçalho e rodapé). Textos
institucionais continuam exigindo deploy — o lojista edita a maior parte da loja, mas não uma
página de Sobre. Este é o mesmo problema do item 3.3, listado aqui porque é o teto da integração.

#### 2.5.4 Sem upload de imagem — a liberação do CMS depende de deploy

**Evidência:** todos os campos de imagem do contrato são `kind: "text"` guardando um **path**
(ex.: `imageUrl: "/brand/hero.jpg"`, em `frontend/public/brand/`), como explica
`defaults.ts:11-14`.

**Impacto:** o caminho é *de mão única*. O lojista consegue **trocar** a imagem se souber a URL
de um arquivo que já esteja publicado, mas **não tem como subir** a foto nova. Na prática, trocar
o hero exige um desenvolvedor publicando em `frontend/public/brand` — a promessa de
"mudar imagem sem deploy" só vale para o caso restrito de arquivo já existente.

**Ação necessária:** endpoint de upload no admin (medusa `File Module` / S3) e o campo de imagem
passando a devolver a URL do arquivo enviado. Este é o item que **de fato destrava** o CMS para
o lojista.

#### 2.5.5 O conteúdo não está versionado no seed principal

**Evidência:** `backend/src/scripts/seed.ts` não referencia `content` nem chama
`seedContent`. O CMS depende do script dedicado `seed-content.ts`.

**Impacto:** provisionar o ambiente pelo caminho padrão (`seed.ts`) deixa a tabela
`content_block` **vazia**. O frontend não quebra — `lib/data/content.ts:53` cai em
`DEFAULT_HOME_SECTIONS` — mas o admin abre **sem nenhuma seção** e o lojista não tem o que
editar. O sintoma ("o CMS está vazio") não aponta para a causa (seed diferente).

**Ação necessária:** chamar o seed de conteúdo ao final de `seed.ts`, ou documentar
explicitamente que os dois scripts são necessários no provisionamento.

#### 2.5.6 `POST /admin/content` não cria seção com `title` obrigatório no contrato

**Evidência (2026-09-26, ambiente local):**

```bash
curl -s -X POST localhost:9000/admin/content -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"instagram","position":75,"enabled":true,"handle":"@teste","title":"Teste","images":[]}'
# 400: Campo obrigatório ausente: "title".
```

`splitPayload` (`backend/src/api/admin/content/route.ts:93`) retira `title` do corpo para a coluna
`content_block.title`, e o `validateData` valida o que sobrou contra o contrato. Só que
`collections`, `featured`, `editorial` e `instagram` têm `title` **também** como campo obrigatório do
`data` — então o POST desses quatro tipos é impossível: o campo some do `data` antes da validação.
`benefits` (sem obrigatório) funciona, e foi por isso que o problema não apareceu antes.

O `title` da coluna, aliás, não aparece em saída nenhuma: `listSections` achata apenas
`id`/`enabled`/`position`/`type` + `data`, e o frontend lê o título de `data.title`.

**Impacto hoje:** contido — a página do admin só faz PATCH (editar seção existente) e o seed grava
pelo service, não pela rota. Vira bloqueador no dia em que o CRM ganhar "criar seção".

**Ação necessária:** manter `title` no `data` quando o contrato do tipo o declara obrigatório (ou
aposentar a coluna `title`, que já não é lida por ninguém), e cobrir com um caso de POST por tipo.

---

### 2.6 Tailwind descarta a opacidade em cor que é variável — texto do hero e dos cards herda a cor errada

**Status: aberto (identificado em 2026-09-26, ao construir a aparência por seção).**

As cores da marca são declaradas como `var(--rv-*)` no `tailwind.config.js` — é o que permite um
tema sazonal recoloriar a loja sem rebuild. O problema: quando a cor é um `var(...)`, o Tailwind
(3.4.19) **não gera** o utilitário que pede opacidade. A classe simplesmente não existe no CSS.

```bash
# CSS servido pelo storefront (dev), 2026-09-26
curl -s localhost:8000/_next/static/chunks/src_1dd3d68c._.css \
  | grep -o 'text-rv-offwhite[^,{ ;]*' | sort -u
# text-rv-offwhite
# text-rv-offwhite:hover      <- nenhuma variante /85 nem /80
```

Reproduzido também fora do app, compilando o Tailwind do repositório (`node_modules/tailwindcss`
3.4.19) com um conteúdo de teste: `text-rv-offwhite/85` não produz regra; `text-rv-offwhite`
produz `color: var(--rv-offwhite)`. O mesmo vale para `bg-rv-dourado/20`, `from-rv-preto/70` e
`via-rv-preto/10` (o modificador é ignorado, e o utilitário sai do CSS).

Sem regra, o elemento não tem cor própria e **herda** — no tema padrão isso é `--rv-fg` (grafite,
`#303033`):

| Onde | Classe escrita | O que a loja mostra hoje |
| --- | --- | --- |
| Hero — subtítulo | `text-rv-offwhite/85` | grafite sobre o scrim escuro da foto |
| Hero — eyebrow | `text-rv-offwhite/80` | idem |
| Card de coleção — subtítulo | `text-rv-offwhite/80` | grafite sobre a foto |
| Card de coleção — scrim | `from-rv-preto/70 via-rv-preto/10` | sem gradiente nenhum: o título fica sobre a foto crua |
| Placeholders de imagem | `bg-rv-dourado/20` | sem tom de fundo enquanto a imagem carrega |

**Correção sugerida:** trocar a cor com opacidade por um token sólido (a opacidade é o ponto que o
Tailwind não consegue compor sobre `var()`), ou migrar esses elementos para as classes de
aparência por seção (`.rv-section-text-*`), que leem
`var(--rv-section-text-color, …)` — ver `backend/src/modules/content/README.md`, seção
*Aparência por seção*.

**Por que não foi corrigido junto com a aparência por seção:** a entrega tinha como requisito
"nada muda até o lojista escolher uma cor", e os fallbacks dessas classes foram escritos para
preservar o estado atual (`currentColor`) exatamente como está — corrigir o contraste junto
misturaria duas mudanças visuais na mesma revisão.

**Contorno imediato, sem deploy:** no CRM, seção Hero → campo *Subtítulo* → trilho *Textos* →
*Cor dos textos* → `Off White` (e nas coleções, que têm o mesmo caso no subtítulo do card, com a
ressalva de que ali o texto claro do card divide o campo com o texto escuro do bloco). Definida a
variável, ela ganha do `currentColor` e o texto volta a aparecer.

**Guarda relacionada:** `scripts/check-contract-parity.mjs` confere que toda classe `.rv-section-*`
definida no `brand.css` é usada na loja e vice-versa — foi assim que a família de classes da
aparência por seção deixou de depender de revisão manual para não virar CSS morto.

---

## 3. 🟡 Médio

### 3.1 CMS sem invalidação imediata de cache

**Evidência:** `frontend/src/lib/data/content.ts` consome `GET /store/content` com a tag global
`content` e `next: { revalidate: 60 }`. A janela passou a ser **explícita no fetch** em
2026-09-26: com `cache: "force-cache"` e apenas a tag, o conteúdo ficava preso indefinidamente
nas rotas que renderizam a cada request (`/cart`, `/account`, `/search`) — o que passou a incluir
o cabeçalho, que agora vem do CMS e aparece em todas as rotas. Nas rotas pré-renderizadas a
defasagem continua sendo a janela do segmento (`revalidate = 3600` em produto/coleção).

**Impacto:** o lojista edita no admin e **espera até 60 segundos** para ver a mudança na
vitrine — sensação de "não salvou" e risco de edição duplicada.

**Ação necessária:** endpoint `POST /api/revalidate` no frontend protegido por *shared secret*,
chamado pelo backend após `POST/PATCH/DELETE /admin/content`. O endpoint **já existe**
(`frontend/src/app/api/revalidate/route.ts`), mas nenhum código o chama — a invalidação hoje é
manual (`curl` documentado no próprio arquivo) e o caminho normal é esperar a janela.

> **Nota de implementação:** a tag **precisa** ser global (`content`). `getCacheOptions`
> prefixa a tag por visitante, o que impede o revalidate de atingir todos os usuários — isso
> foi exatamente um bug corrigido nesta fase. Não regredir.

---

### 3.2 Zero testes automatizados e zero CI

**Evidência:** não há suíte de testes no projeto; a única rede de segurança é o script
`scripts/check-contract-parity.mjs` (valida paridade backend ↔ storefront ↔ admin: tipos, campos,
defaults, o `nav` do seed contra o fallback do storefront e as chaves de ícone oferecidas no admin
contra o registro do storefront), executado manualmente.

**Impacto:** refatorações e novos módulos não têm verificação automática; uma divergência de
contrato só é descoberta em runtime ou rodando o script à mão.

**Ação necessária:**

1. Adicionar CI (GitHub Actions / Azure Pipelines) rodando `tsc`, `check-contract-parity.mjs`
   e build do frontend.
2. Cobrir com testes: `service.ts` do módulo `content`, rotas `GET /store/content` e
   `GET/POST/PATCH/DELETE /admin/content` (incluindo os 400 de validação) e o fluxo de checkout.

---

### 3.3 CMS cobre apenas a superfície `home`

**Status: rodapé resolvido em 2026-09-26; resta a superfície institucional.**

**Evidência:** o módulo `content` está populado apenas com `surface: "home"` (9 blocos: as 7
seções do protótipo + o `nav` do cabeçalho + o `footer` do rodapé). Cabeçalho e rodapé viajam
nessa mesma superfície, mas **não** são seções da home: quem os renderiza é o layout
(`(main)/layout.tsx` → `headerSections()`/`footerSections()`), em todas as rotas, e o render da
home ignora os dois tipos (`case "nav"`/`case "footer": return null`). O tema da loja é
*file-based* (`themes/*/theme.json`), fora do CMS.

**Impacto:** textos institucionais (Sobre, Contato, trocas) continuam exigindo deploy para
alterar. O rodapé já não: as colunas (de catálogo — categorias ou coleções — ou com links
digitados) e as redes sociais são campos do bloco `footer` em **Conteúdo da vitrine**, sem
coluna padrão no código, com paridade travada pelo script contra o fallback do storefront.

**Ação necessária:** estender `surface` para `institutional` (a modelagem já suporta; é trabalho
de conteúdo + render), sem migrar o tema para o CMS nesta rodada.

---

### 3.4 `README.md` desatualizado

**Status: resolvido em 2026-09-24, reescrito em 2026-09-26.** O `README.md` documenta o fluxo real
de execução (seções *Como a Aplicação Roda Localmente*, *Admin do Medusa em Desenvolvimento*,
*Banco de dados e dados iniciais* e *Troubleshooting*), as portas efetivas (8000/9000/5438/6381) e
o arquivo de ambiente único (`.env`, a partir de `.env.example`).

**Pendência residual resolvida em 2026-09-24 (containerização).** O fluxo foi unificado em
Docker, eliminando a divergência entre `Makefile` e scripts:

- Deixaram de existir `start.sh`/`stop.sh` iniciando processos no host (`nohup`, PIDs em `/tmp`,
  `corepack`). Toda a stack — incluindo o storefront, que ganhou `Dockerfile` e serviço próprios —
  subiu para o Compose.
- O `Makefile` passou a ser a única interface: alvos finos sobre `docker compose`, com o modo
  escolhido pela presença do `-f` (ver abaixo). Foram adicionados `make ps`, `make logs-all`,
  `make shell-backend`, `make shell-frontend` e `make health`.
- A montagem `./backend/src:/app/src` saiu da base e foi para o overlay de desenvolvimento.

**Estrutura final do Compose (2026-09-26 — modelo único):** `docker-compose.yml` (base única, com
os 4 serviços, estágio `target: runner`, `NODE_ENV=production`, limites de memória e rotação de
log) + `docker-compose.override.yml` (conveniência de desenvolvimento: estágio `target: dev`, bind
mounts, volume anônimo de `node_modules`, `RUN_MIGRATIONS=0`). **O modo é a presença do `-f`**, que
o Compose já usa para decidir se lê o override automaticamente:

```bash
docker compose up -d                         # DEV  (base + override)
docker compose -f docker-compose.yml up -d   # PROD (só a base)
```

Os overlays `docker-compose.dev.yml`/`docker-compose.prod.yml`, o `--env-file .env.docker` e o
script `scripts/build-frontend.sh` foram **removidos** — eram três mecanismos para expressar a
mesma distinção e a origem da maior parte das divergências documentadas neste arquivo. O arquivo
de ambiente é o **`.env` da raiz** (modelo versionado: `.env.example`).

---

### 3.5 Admin não é servido em modo dev

**Evidência:** o modo de servir o admin é decidido por `NODE_ENV` no loader
`@medusajs/medusa/dist/loaders/admin.js`: em `development` compila `src/admin/` ao vivo; caso
contrário serve `.medusa/server/public/admin` — diretório que **não existe** neste repositório
(nunca foi executado `yarn build` no host). O artefato gerado `backend/.medusa/client/entry.jsx`
comprova o efeito: lista apenas o plugin npm (`plugin0 = @medusajs/draft-order/admin`) e
**omite o plugin local de `backend/src/admin`**, de modo que a rota `content` nunca é
compilada.

**Impacto:** a tela **Conteúdo da vitrine** não aparece no menu do Admin, embora o módulo
`content`, o endpoint `GET /store/content` e o arquivo
`src/admin/routes/content/page.tsx` estejam corretos. Foi isso que originou a
percepção de "elo incompleto" na seção 2.5.

**Status: resolvido em 2026-09-24 (containerização).** Cada ambiente passou a ter um `NODE_ENV`
correto e explícito, controlado pelo overlay do compose:

| Ambiente | Comando | `NODE_ENV` | Como o admin é servido |
|---|---|---|---|
| DEV (`docker-compose.yml` + `docker-compose.override.yml`) | `yarn dev` (`medusa develop`) | `development` | compilado ao vivo de `src/admin/` — o plugin local aparece |
| PROD (`docker compose -f docker-compose.yml`) | `yarn start` (`medusa start`) | `production` | `.medusa/server/public/admin`, gerado no **build da imagem** |

O ponto crítico anterior era justamente rodar `yarn start` sem nunca ter executado
`yarn build`. Na imagem Docker a etapa `builder` do `backend/Dockerfile` executa
`yarn build`, de modo que o artefato `.medusa/server/public/admin` **existe na imagem** e é
servido em produção. Assim, o admin funciona nos dois modos, sem depender de build manual no
host.

Critério de aceite: item "Conteúdo da vitrine" visível na **sidebar principal** (modo dev),
listado em `GET /admin/layouts/main-sidebar/configuration`, e `entry.jsx` listando o plugin
local.

> **Nota (2026-09-26):** a rota passou de `settings/content` para `content`. Com o path antigo
> o item nunca ia para o menu principal: o dashboard o classificava como extensão da sidebar
> de Configurações (`DashboardApp.populateMenus` → `path.startsWith("/settings")`). O débito
> acima (artefato ausente) já estava resolvido — o que restava do sintoma "não aparece no
> menu" era apenas o **local** do item na navegação.

---

## 4. 🔵 Baixo

### 4.1 Sem `sitemap.ts` / `robots.ts`

**Verificado:** não existem `frontend/src/app/sitemap.ts` nem `frontend/src/app/robots.ts`.

**Impacto:** indexação incompleta pelos buscadores e ausência de controle sobre o rastreamento.

**Ação necessária:** gerar `sitemap.ts` dinâmico (produtos + coleções + institucionais) e
`robots.ts` liberando o público e bloqueando `/account`, `/checkout` e `/admin`.

---

### 4.2 Rota `/search` inexistente

**Impacto:** o usuário não tem forma de buscar produto quando a navegação por coleção falha
(agravado pelo item 2.1).

**Ação necessária:** rota de busca reaproveitando o endpoint de produtos do Medusa.

---

### 4.3 Imagens hero em baixa resolução

**Evidência:** `frontend/public/brand/hero.jpg` e `campaign-*.jpg` são placeholders.

**Impacto:** primeira impressão da marca comprometida em telas grandes.

**Ação necessária:** substituir pelo material final do cliente e validar peso / LCP.

---

## 5. Itens verificados e já cobertos

Registrado para evitar retrabalho — foram levantados como suspeita e **não** são débito:

| Item | Verificação | Situação |
|---|---|---|
| `backend/Dockerfile` ausente | `ls -la backend/Dockerfile` | ✅ Existe (671 bytes) |
| Opções de frete inexistentes | `seed.ts:235-300` | ✅ PAC e SEDEX existem (porém flat — ver 1.1) |
| Perfil/armazém de envio ausente | `seed.ts:190-233` | ✅ Shipping profile, fulfillment set e service zone criados |
| Provider de fulfillment | `seed.ts:184` | ✅ `manual_manual` configurado |
| `.env` versionado com segredo real | `git ls-files` + `.gitignore` | ✅ **Não** está versionado — só `.env.example` e `frontend/.env.template`. Débito real é o fallback do compose (ver 1.3) |
| CPF no backend | `order-customer-indexer.ts`, `orders/track/route.ts` | ✅ Backend já suporta (falta só o front — ver 2.4) |
| CORS divergente | `.env.example:88-90` + `docker-compose.yml:138-140` | ✅ **Corrigido** — todas as origens em `:8000`/`:9000`; `3000`/`5173` removidos (ver 1.2) |
| Build do storefront dependia de rede | `next build` com `HTTPS_PROXY` apontando para proxy morto | ✅ **Corrigido** — build 100% offline: `generateStaticParams()` removido + fontes self-hosted (ver 6.3 e 6.7) |
| `next/font/google` no `layout.tsx` | `grep -rl gstatic frontend/.next/static/css/` | ✅ **Corrigido** — `next/font/local` com 3 `.woff2` versionados; nenhuma referência a `gstatic` no CSS gerado (ver 6.7) |
| BuildKit / `build.network` / builder legacy | `docker compose build` com BuildKit ativo | ✅ **Irrelevante agora** — sem rede no build não há rede a anexar (ver 6.5) |
| `medusa build` falhava com TS2339 | `src/subscribers/order-customer-indexer.ts:53` | ✅ **Corrigido** — `let targetCustomer = null` deixava o TS inferir o tipo `null`, rejeitando as atribuições de `CustomerDTO`. 9 erros `tsc` que quebravam `yarn build` e o build da imagem de produção |
| Postgres exige TLS | `docker-compose.yml` (DATABASE_URL) | ✅ **Corrigido** — o Medusa forçava `ssl: { rejectUnauthorized: false }` por heurística de URL. `?sslmode=disable` resolve (ver nota abaixo) |
| Cabeçalho fixo no código (`NAV_LINKS`, `SideMenuItems`, ícones estáticos) | `grep -rn 'NAV_LINKS\|SideMenuItems' frontend/src` + `curl localhost:8000/br` | ✅ **Resolvido em 2026-09-26** — zero ocorrências; o menu vem do bloco `nav` do CMS (ver 2.2) e o HTML traz `data-testid="início-link"` etc. |
| Faixa de benefícios com colunas fixas (`grid-cols-4`) | Contagem real do CMS (1, 2, 3, 4, 5 e 8 itens) medida no Chrome headless via CDP, em 375–1920px | ✅ **Corrigido em 2026-09-26** — a faixa é agnóstica ao nº de itens: 1 item = linha inteira, 5 = 5 em linha no desktop, no celular quebra de 2 em 2. Zero rolagem horizontal e nenhuma linha com sobra de fundo |
| Âncoras do menu sem alvo no DOM | `curl localhost:8000/br` (procurando os `id`) + clique real no Chrome headless via CDP | ✅ **Corrigido em 2026-09-26** — `/#hero`, `/#collections` e `/#editorial` eram documentados, mas nenhum elemento tinha esses `id`: o `nav-link` fazia `preventDefault()` e rolava zero. Agora o registro de seções embrulha cada seção em `div[id={section.id}]` e `.rv-anchor` (`brand.css`) compensa o cabeçalho fixo — "Sobre" (bloco `editorial`) rola até a seção com o topo 80px abaixo do header |

---

## 6. ⚠️ Armadilhas de ambiente Docker (não são débitos, são pré-requisitos)

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

porque `docker-entrypoint.sh` invoca `yarn medusa db:migrate`. O `backend/Dockerfile` copia o
`node_modules` do estágio `builder` e remove as devDependencies com
`yarn workspaces focus --production --all` (usar o próprio Yarn preserva o `install-state.gz`;
apagar pastas à mão corromperia o estado).

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
