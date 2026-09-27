<!--
  Parte 2 do registro de débito técnico (itens 2.x).
  Entrada, legenda de severidade e mapa dos assuntos: `docs/DEBITO-TECNICO.md`.
-->

# 2. 🟠 Alto

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

