# 09 — Backlog de Implementação

**Formato por item:** ID · título · descrição · tipo · prioridade · dependências · arquivos
impactados · critérios de aceite · complexidade · pré-requisitos.

**Prioridade:** CRÍTICA · ALTA · MÉDIA · BAIXA · **Complexidade:** baixa · média · alta

---

## Fase 0 — Fundação modular

Pré-requisito de tudo. Curta, e cria a estrutura que os itens seguintes consomem.

### ✅ F0 · Fundação modular — guardas, catraca e doc 15 — **FEITO** (`9fd1c79826`)

**O que foi feito:** três guardas novas de Node puro e a doutrina num doc. O `check-boundaries.mjs`
ganhou as camadas do storefront — **R-A** (`lib` ↛ `modules`), **R-B** (`lib`/`modules` ↛ `app`),
**R-C** (`lib` fora de `lib/data` ↛ `lib/data`), **R-D** (o checkout só conhece a fachada
`@lib/payments`) e **R-E** (ciclo de import de valor) — com as exceções vivas em
`scripts/baselines/boundaries.json`: 17 entradas, cada uma com `why` e `diesIn`, sob a regra de
ouro "a lista só encolhe" (violação corrigida sem remover a entrada reprova a guarda). Nasceram
`check-comments.mjs` (catraca do comentário: cabeçalho ≤5 linhas, densidade ≤12% para arquivo novo,
baseline versionado de 313 arquivos, `--report` para os piores, `--write` para reancorar) e
`check-storefront-tests.mjs` (convenção `__tests__/<alvo>.unit.spec.ts` e `src/__checks__/`; com
`STOREFRONT_RUNNER=1` no `make test` ele compara disco × runner: 34 × 34). As três entraram no
`make check` — Node puro, sem `node_modules`, no hook de commit e no job `guard` da CI. O doc 15
nasce como dono da narrativa: o cabeçalho do `check-boundaries.mjs` caiu de 34 para 5 linhas e o
arquivo SAIU do baseline de comentário (142 → 23 linhas de comentário).

**Medido na varredura (13/10/2026):** 17 violações de camada vivas (6 morrem na F2, 4 na F5, 7 no
RV-048) · **6 ciclos reais**, dos quais 4 não estavam no inventário e só apareceram quando a guarda
passou a rodar (2 no adapter Stripe, 2 no `modules/account`, por causa do `enum LOGIN_VIEW` que mora
no template) · 19.512 linhas de comentário nas cinco árvores (contrato 54,6%, backend
32,0%, scripts 30,4%, CRM 28,6%, storefront 26,0% — 19.375 depois dos cortes da própria
F0) · 32 specs fora da convenção · `lib/util` com 45
arquivos e 6.622 linhas.

**Verificação de duas vias (11 sondas, injetadas e removidas na mesma execução):** R-A, R-B, R-D e
R-E reprovam com a violação injetada e voltam verdes sem ela; uma exceção viva removida do baseline
reprova (a lista só encolhe); um spec fora de `__tests__` reprova; um cabeçalho de 8 linhas em
arquivo novo reprova. `make check` verde e `make test` verde com a linha nova (24 suítes/424 no
backend, 9/104 no CRM, 34/466 no storefront).

**Arquivos:** *novos:* `scripts/lib/imports.mjs`, `scripts/lib/comments.mjs`,
`scripts/check-comments.mjs`, `scripts/check-storefront-tests.mjs`,
`scripts/baselines/{boundaries,comments,storefront-tests}.json`,
`docs/real-valor/15-arquitetura-modular.md`
· *alterados:* `scripts/check-boundaries.mjs`, `Makefile` (alvos `check` e `test`),
`.github/workflows/check.yml` (job `guard`; e os números das suítes, que estavam obsoletos)

**Guarda que fica verde:** as quatro guardas do `make check` + a convenção no `make test`
**Pré-requisito:** nenhum — é a fundação
**F1–F10:** o que cada fase move e a guarda que ela deixa mais verde está no doc 15 §15.6; a
dívida que cada uma apaga, no §15.8.

### RV-049 · Teste negativo versionado das guardas de camada

**Descrição:** a F0 verificou as guardas nos dois sentidos com sondas descartáveis (injetar a
violação, rodar, remover). Versionar isso faz a guarda se provar sozinha: hoje, se o
`resolveSpecifier` deixar de resolver (um apelido renomeado no `tsconfig`, por exemplo), as 17
exceções viram entradas mortas e `check-boundaries.mjs` reprova — o baseline é o canário —, mas
R-B, que nasce com zero violação, poderia parar de ver em silêncio.
**Tipo:** arquitetura · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** F0 · **Arquivos:** novo `scripts/check-boundaries.negative.mjs`
**Aceite:** um alvo roda as sondas e reprova se alguma guarda deixar de reprovar

## Fase 1 — Código morto

Um commit: o que ninguém chama sai do repositório, e o que parecia morto e não era fica
registrado com o porquê. A guarda que fica mais verde é a R-A (5 → 3): o `SortOptions`
sai do componente e o dono do vocabulário passa a ser o dado.

### ✅ F1 · Código morto — **FEITO** (`3813a4fc6c`)

**O que foi feito:** sete arquivos apagados — `lib/constants.tsx`, o diretório `medusa-cta/` e
cinco ícones órfãos do starter (`bancontact`, `ideal`, `paypal`, `medusa`, `nextjs`) —, o tipo
`FeaturedProduct`, a função `retrieveCollection` e as quatro funções mortas de `lib/data/cart.ts`
(`applyGiftCard`, `removeDiscount`, `removeGiftCard`, `submitPromotionForm`: 55 linhas, a maior
parte comentada). Três nomes perderam o `export` e continuaram vivos como privados —
`themeFromRow` (usado por `themesFromRows`), `isObject`/`isArray` (por `isEmpty`) e `DEFAULT_SORT`
(pelo próprio seletor). E o `SortOptions` mudou de casa: nasceu
`frontend/src/lib/catalog/types.ts` com o tipo **e** o `DEFAULT_SORT` — o valor `"created_at"`
estava digitado em **cinco** lugares (o seletor, três templates e o dado) e agora tem um dono;
dez consumidores passaram a importar de lá. **R-A 5 → 3**.

**O que parecia morto e não está** (medido antes de apagar, e por isso **não** foi tocado):
`lib/util/isEmpty.ts` está vivo (`money.ts`, 17 consumidores), `lib/util/repeat.ts` tem 6
(esqueletos, carrinho e pedido), e `getOrSetCart`/`updateCart` são usados dentro do próprio
`cart.ts` (`addToCart`, `setAddresses`, `updateRegion`) — "zero importadores" contando só de fora
do arquivo engana. Os falsos positivos que a varredura já tinha achado seguem de pé (`schema.ts`
por `export *`; `backend/src/{links,scripts}` carregados por caminho).

**Lido integralmente na fase:** `lib/constants.tsx`, `lib/theme.ts`, `lib/theme.spec.ts`,
`lib/util/{isEmpty,money,repeat,sort-products}.ts`, `lib/data/{cart,collections,products}.ts`,
`types/global.ts`, `medusa-cta/index.tsx`, `sort-products/index.tsx` e os 10 consumidores do
`SortOptions` (`app/…/{store,collections,categories}`, `modules/{store,categories,collections}/templates`,
`catalog-toolbar`).

**Medido (13/10/2026, pós-F1):** comentário em `frontend/src` 9.840 → 9.799 linhas (37.898 →
37.621); baseline 313 → 312 arquivos; `modules/` 171 → 165 arquivos (16.962 → 16.804 linhas);
`lib/` 12.912 → 12.806; `types/` 59 → 52; `lib/data/cart.ts` 476 → 421; exceções de camada
17 → 15 (restam 4 na F2, 4 na F5 e 7 no RV-048).

**Guarda que fica verde:** R-A 5 → 3 — as duas exceções do `SortOptions` saíram do baseline (a
lista só encolhe, e a guarda reprova se uma exceção morta ficar) — e a catraca do comentário
reancorada para baixo (o `--write` no mesmo commit).
**Gate:** `make check` · `make types` · `yarn test` — os três verdes (34 arquivos/466 testes no
storefront) e o hook de commit rodando o `make check`.
**Arquivos:** *novo:* `frontend/src/lib/catalog/types.ts` · *alterados:*
`lib/{data/cart,data/collections,data/products,theme,util/isEmpty,util/sort-products}.ts`,
`types/global.ts`, os 10 consumidores do `SortOptions`,
`scripts/baselines/{boundaries,comments}.json` e o doc 15 · *removidos:* os sete arquivos mortos.
**Pré-requisito:** F0

---

## Fase 2 — `lib/util` dissolvido por dono

A pasta que existia por acúmulo (45 arquivos, 6.622 linhas) sai inteira: cada peça vai
para o dono do que ela decide, e o checkout passa a conhecer o pagamento por um nome
só. A guarda que fica mais verde é a R-D (4 → 0).

### ✅ F2 · O `lib/util` dissolvido por dono — **FEITO** (`ba4fff683e`)

**O que foi feito:** os 45 arquivos foram para seis donos, e nenhum ficou em "util":

- **`lib/catalog`** (19 arquivos) — a regra e a leitura da peça e do catálogo:
  `catalog-filters`, `filter-chips`, `category-tabs`, `product-availability`,
  `product-enrichment`, `product-rating`, `product-sections`, `sort-products`,
  `get-product-price`, `get-percentage-diff`, `product` e os 8 specs deles. É o dono
  que a F1 estreou com o `types.ts`.
- **`lib/ui`** (9) — apresentação sem React: `money`, `media` (o endereço que o
  `next/image` busca), `media-wiring.spec`, `motion`, `carousel` e `repeat` (o dos
  esqueletos).
- **`lib/content`** (8) — a regra de uma seção do conteúdo: `hero`, `launches`,
  `ticker`, `marquee` e os specs, junto do que já morava lá (`page-seo`,
  `page-surfaces`, `markdown`, `home-sections`).
- **`lib/checkout`** (3) — `shipping-quote` (CEP e opções de entrega) e
  `compare-addresses`.
- **`lib/payments`** (2) — `installments` (as duas linhas do parcelamento e do Pix) e
  o spec; a fachada `@lib/payments` passou a exportá-lo, junto do `paymentLabel`.
- **`lib/medusa`** (3) — a integração com o SDK: `env` (`getBaseURL`), `medusa-error`
  e `get-locale-header`.
- **`isEmpty`** não ganhou dono: o único consumidor era o `money`, e a checagem virou
  a linha `currency_code?.trim()` dele. O arquivo morreu.

**O checkout conhece o pagamento por um nome só (R-D 4 → 0):** os quatro componentes
(`payment`, `payment-button`, `payment-container`, `payment-wrapper`) trocaram
`@lib/payments/registry` por `@lib/payments`, a cópia local do `needsInlineInput`
saiu (a fachada já respondia, com o mesmo `fulfillment` do adapter) e o resumo do
pedido deixou de buscar `paymentLabel` no subcaminho. As quatro entradas do baseline
morreram com elas.

**A malha e a prosa:** 28 comentários de componente citavam `lib/util/<peça>`, e o
`check-boundaries` acusou o que mais ninguém veria — o caminho da exceção R-C e do
ciclo R-E do locale (`lib/util/get-locale-header.ts` → `lib/medusa/…`) e o ciclo do
Stripe, que **ganhou um nó**: o `payment-container` passou a importar a fachada, e o
DFS do ciclo passa por `lib/payments/index.ts`. Baselines: `boundaries.json` 15 → 11
exceções; `comments.json` reancorado (312 → 311 arquivos); `storefront-tests.json`
com os 18 specs em casa nova (a lista é de caminhos e não tem `--write`, então o
reancoramento foi explícito).

**A promessa que a fase não podia cumprir:** o doc 15 prometia `R-C 2 → 1` aqui. Não
dá: das duas exceções, uma é o adapter do Stripe (RV-048) e a outra é o ciclo do
locale — justamente o que o **F5** desmancha. A tabela do §15.6 foi corrigida em vez
de cumprida pela metade.

**Medido (13/10/2026, pós-F2):** `lib/` 97 arquivos/12.806 linhas → 96/12.794 (uma
peça a menos e nenhum arquivo novo: os seis donos são internos); `modules/` 16.804 →
16.793 (as 11 linhas do `needsInlineInput` duplicado); comentário em `frontend/src`
9.799 → 9.790; baseline de comentário 312 → 311; exceções de camada 15 → 11;
`lib/catalog` 20/3.646, `lib/ui` 9/1.302, `lib/content` 18/3.047, `lib/checkout`
3/287, `lib/medusa` 3/33.

**Lido integralmente na fase:** as peças cujo dono era uma decisão — `money`,
`motion`, `installments`, `shipping-quote`, `compare-addresses`, `env`,
`medusa-error`, `get-locale-header`, `repeat`, `sort-products`, `isEmpty`, `product`
— e as que foram editadas (`lib/payments/index.ts`, os quatro componentes do
checkout, o resumo do pedido). As demais foram classificadas pela responsabilidade
que o próprio cabeçalho declara (§15.5), com o fan-out e as arestas medidos; o
veredito é do `tsc`, do vitest e do build — nenhuma ficou no dono errado.

**Guarda que fica verde:** R-D 4 → 0 (o checkout não conhece subcaminho de
pagamento), com a catraca de comentário e a convenção de teste reancoradas.
**Gate:** `make check` · `make types` · `yarn test` (34 arquivos/466 testes) · o
`next build` de produção · GET `/br` = 200 na stack de pé.
**Arquivos:** *novos donos:* `lib/{catalog,ui,checkout,medusa}/` · *movidos:* 44
arquivos (com 15 specs) · *removido:* `lib/util/isEmpty.ts` · *alterados:* os quatro
componentes do checkout, `lib/payments/index.ts`,
`modules/order/components/payment-details`, 28 comentários de prosa,
`scripts/baselines/{boundaries,comments,storefront-tests}.json`, este doc e o doc 15.
**Pré-requisito:** F1

---

## Fase 3 — A convenção de teste

O lugar do spec deixa de ser livre: unidade colada no alvo
(`__tests__/<alvo>.unit.spec.ts`), guarda de arquitetura em `src/__checks__/`. A guarda
que fica mais verde é a convenção — 32 → 0, e o baseline dela fica vazio.

### ✅ F3 · A convenção de teste — **FEITO** (`22b255a186`)

**O que foi feito:** os 32 specs fora da convenção mudaram de casa — 30 de unidade para
`<dono>/__tests__/<alvo>.unit.spec.ts` (o spec fica colado no alvo, um nível abaixo
dele) e 2 de arquitetura para `frontend/src/__checks__/` (`media-wiring` e `ruler`: eles
leem o FONTE de outros arquivos, não renderizam nada).

**O que o movimento obrigou a corrigir** (e que o vitest acusou na hora):

- as 20 specs de `lib/` importavam o alvo por `./<alvo>`; agora é `../<alvo>`;
- os 5 `index.spec.tsx` de componente importavam `"."`; agora é `".."`;
- os 2 `__checks__` montam o caminho de leitura com `join(__dirname, …)`: o `ruler`
  perdia três `..` para chegar ao `brand.css` e um nível para chegar aos componentes da
  home, e o `media-wiring` perdia um. É a armadilha de mover teste que lê arquivo: **o
  caminho é dado, não import** — e quem o verifica não é o `tsc`, é o vitest;
- **duas specs de unidade também leem o fonte** (`page-surfaces` lê as rotas fixas do
  `app/`, o rodapé e o `sitemap`; `product-enrichment` lê `product-fields`, `products` e
  as telas que listam peças): elas só apareceram no `vitest run`, e as duas ganharam um
  `".."`;
- 28 comentários de prosa passaram a citar `__tests__/<alvo>.unit.spec.ts`, e os
  caminhos inteiros foram reancorados (o `[slug]/page.tsx` cita o `page-surfaces`, o
  `editorial-callout` cita o `__checks__/ruler.spec.ts`).

**Medido (13/10/2026, pós-F3):** **34 na convenção, 0 no baseline** (eram 2 + 32);
`lib/` 96/12.794 → 95/12.544 e `modules/` 165/16.793 → 164/16.397 (as duas guardas
saíram de lá para `src/__checks__/`, que tem 2 arquivos/650 linhas); o comentário de
`frontend/src` não mudou (9.790) e a catraca segue em 311 arquivos — **mover não é
comentar**; os 466 testes continuam 466.

**Guarda que fica verde:** a convenção de teste 32 → 0, com o baseline dela **vazio** —
não é mais uma lista de exceções a vencer, é o registro de que não há nenhuma, e é o
estado que o F10 tem de manter.
**Gate:** `make check` · `make types` · `yarn test` (34 arquivos/466 testes) e a
convenção em modo RUNNER (`STOREFRONT_RUNNER=1`): o que o vitest lista é o que o disco
tem.
**Arquivos:** *movidos:* 32 specs (30 para `__tests__/`, 2 para `__checks__/`) ·
*alterados:* os 2 `__checks__` (caminhos de leitura), 25 specs (import relativo), 4
comentários com caminho, `scripts/baselines/storefront-tests.json` (vazio),
`scripts/baselines/comments.json` (reancorado), este doc e o doc 15.
**Pré-requisito:** F2

---

## Fase 4 — Os tipos com dono

A pasta `src/types` (2 arquivos, 52 linhas) some: cada tipo vai para o dono do que ele
descreve, e o caminho NU (`from "types/global"`, resolvido pelo `baseUrl`) vira o
apelido que o resto do storefront já usa.

### ✅ F4 · Os tipos com dono — **FEITO** (`52646a480d`)

**O que foi feito:**

- `lib/catalog/types.ts` (o dono que a F1 estreou) recebe `VariantPrice`,
  `ProductColor` e `ProductEnrichment`, junto do `SortOptions`/`DEFAULT_SORT`. As
  regras longas da cor e do enriquecimento **ficaram onde sempre estiveram** — em
  `lib/catalog/product-enrichment.ts`, que é quem lê o dado bruto —, e o arquivo de
  tipos guarda a forma com uma linha por tipo: a catraca manda (6 comentários em 37
  linhas é o teto, e as três doc-comments originais somavam 10).
- `lib/ui/types.ts` recebe o `IconProps`, que 11 ícones e o `lib/content/social-icons`
  importavam por `from "types/icon"`.
- `lib/checkout/types.ts` recebe o `StoreFreeShippingPrice` (o do frete grátis, que é
  da entrega).
- 19 imports trocaram o caminho nu pelo apelido; os 4 adapters de pagamento que subiam
  `../../types` passaram a `@lib/payments/types` — o apelido vale também dentro do
  pacote, e era o único lugar do storefront que ainda subia dois níveis para achar um
  tipo seu.
- `frontend/src/types/` deixa de existir: não há mais tipo sem dono de camada.

**Medido (13/10/2026, pós-F4):** camadas sem regressão (R-A 3 · R-C 2 · R-D 0 · R-E 6)
e convenção em 0; comentário de `frontend/src` 9.790 → 9.773 (o `types/global` tinha
15 linhas de comentário, e as três que vieram viraram uma linha cada) e o baseline da
catraca 311 → 310; `lib/` 95/12.544 → 97/12.583 (dois arquivos de tipo novos, e o
`catalog/types.ts` com 37 linhas); `types/` 2/52 → não existe.

**Guarda que fica verde:** a catraca de comentário (o arquivo de tipos novo não herdou
a exceção de ninguém e coube no teto) e a §15.1 do doc 15, que perde a linha do
`types/` — a tabela das camadas passa a ter só camada com dono.
**Gate:** `make check` · `make types` · `yarn test` (34 arquivos/466 testes).
**Arquivos:** *novos:* `lib/ui/types.ts`, `lib/checkout/types.ts` · *alterados:*
`lib/catalog/types.ts`, 19 arquivos que importavam o caminho nu, `lib/payments/adapters/*`
(4), `scripts/baselines/comments.json`, este doc e o doc 15 · *removidos:*
`types/global.ts`, `types/icon.ts`.
**Pré-requisito:** F3

---

## Fase 5 — Os dois ciclos

O grafo de valor do storefront fica sem ciclo: o locale vira **folha** (um módulo que
não importa nada do projeto) e a `enum` do `account` sai do template. R-C 2 → 1 e
R-E 6 → 3 — e as sete exceções que sobram são todas do RV-048 (o adapter Stripe).

### ✅ F5 · Os dois ciclos — **FEITO** (`1c6d6e3c60`)

**O que foi feito:**

- `lib/medusa/locale-cookie.ts` (novo, folha): o nome do cookie e o `readLocale()` — só
  `next/headers`, nenhum import do projeto. O `get-locale-header` (que está na cadeia do
  SDK) e o `locale-actions` (o dado, que importa o SDK) passaram a ler a folha: o ciclo
  `config → locale-header → locale-actions → config` desmancha porque o **meio** dele
  deixou de ser o dado.
- `modules/account/lib/login-view.ts` (novo, folha): a `enum LOGIN_VIEW`, que era
  exportada pelo `login-template`. Um `enum` é **valor** de execução, não tipo — então o
  template importava o formulário que importava o template. O template e os dois
  formulários (`login`, `register`) passaram a ler a folha.
- `boundaries.json`: as quatro exceções que a fase prometia apagar saíram — a R-C do
  locale e os três ciclos R-E (o do locale e os dois do `LOGIN_VIEW`). A guarda as
  apontou como mortas na primeira execução, e é isso que a lista só-encolhe verifica.
- A catraca foi reancorada para baixo (`--write`, previsto no §15.4 para quem desmancha
  ciclo): o `locale-actions` perdeu **6 linhas de comentário que só repetiam o nome**
  (`getLocale`, `setLocaleCookie` — a política manda cortar isso, e a folha nova já
  documenta a leitura). Sem esse corte a árvore subiria 3 linhas com as duas folhas.

**Medido (13/10/2026, pós-F5):** exceções de camada 11 → **7** (R-A 3 · R-C 1 · R-E 3,
todas do RV-048); comentário em `frontend/src` 9.773 → 9.770; baseline da catraca 310 →
309 arquivos; R-D 0 e convenção 0 intactos.

**Guarda que fica verde:** R-C e R-E — os dois ciclos que davam nome à fase deixam de
existir, e as exceções que os registravam saem do baseline.
**Gate:** `make check` · `make types` · `yarn test` (34 arquivos/466 testes).
**Arquivos:** *novos:* `lib/medusa/locale-cookie.ts`,
`modules/account/lib/login-view.ts` · *alterados:* `lib/medusa/get-locale-header.ts`,
`lib/data/locale-actions.ts`, `modules/account/templates/login-template.tsx`,
`modules/account/components/{login,register}/index.tsx`,
`scripts/baselines/{boundaries,comments}.json`, este doc e o doc 15.
**Pré-requisito:** F4

---

## Fase 6 — A régua partida

O `brand.css` (5.248 linhas, 2.039 de comentário) deixa de ser um arquivo e passa a ser um
**manifesto**: dezoito parciais em `styles/brand/`, na ordem do cascade, e a prova de que a
concatenação dos dezoito devolve o arquivo original **byte a byte**.

### ✅ F6 · A régua partida — **FEITO** (`593b50c7ce`)

**O que foi feito:**

- `frontend/src/styles/brand/` (novo): dezoito parciais cortados nas costuras que o próprio arquivo
  já tinha — os 23 banners `/* --- … */` (1438–3779) e os blocos de doc-comment das seções que não
  tinham banner. Todo corte é `}` / linha vazia / abre-comentário, e o parcial seguinte leva o seu
  bloco de comentário consigo: `01-tokens` (os tokens e o degrau de desktop do ritmo), `02-base`,
  `03-faixas` (o ticker e a faixa do Instagram), `04-trilho`, `05-card-vitrine`, `06-cromo`,
  `07-navegacao`, `08-catalogo`, `09-produto`, `10-sacola`, `11-checkout`, `12-conta`, `13-rodape`,
  `14-acessibilidade`, `15-card-home`, `16-home`, `17-vitrine-secoes` e `18-prose`.
- `brand.css` passa a ser o manifesto: dezoito `@import`, na ordem do cascade, e mais nada — **sem
  uma linha de comentário**. Um ponteiro de uma linha já levantaria o total da árvore, e a narrativa
  da partição é deste doc e do doc 15: é a política da casa aplicada ao pé da letra. O nome e o lugar
  dele em `globals.css` **não mudam**, e é por isso que as referências em prosa ao `brand.css`
  espalhadas pelo código (o `theme.ts`, o `motion.ts`, o contrato, os testes do carrossel e da
  régua) continuam verdadeiras: o bundler vê o mesmo arquivo, na mesma posição.
- Os **dois leitores por caminho** que a F3 já tinha mapeado foram reancorados: a régua do storefront
  (`src/__checks__/ruler.spec.ts`, que lia o `brand.css` inteiro e fatiava a partir de um `@media`)
  e o CSS de aparência do backend
  (`backend/src/modules/content/__tests__/assets.unit.spec.ts`, que confere variável escrita ×
  consumida). Os dois passaram a ler o manifesto e a concatenar os parciais — a string é a mesma de
  antes, byte a byte —, e a emenda não gastou uma linha de comentário nova em nenhum deles (a catraca
  veria).
- A catraca foi reancorada (`--write`, o caso que o §15.4 nomeia): a entrada do `brand.css` (2.039
  comentários) sai, as dezoito dos parciais entram — arquivo novo não herda exceção de ninguém, e a
  régua é densa em todas as dezoito —, e o **total da árvore não muda**: 9.770 → 9.770.

**A prova de concatenação byte a byte:**

- **na fonte:** a soma dos dezoito parciais, na ordem do manifesto, é o arquivo original —
  `sha256 fd0471f4b3a88b4b9a21a9e9c498b7bc69d6c2f0d8e9cf9b59d1d0001abb5983`, 173.662 bytes nos dois
  lados; e o contador da casa fecha a partição (197+87+154+…+57 = **2.039** linhas de comentário, a
  conta exata do arquivo de antes).
- **no bundle:** com o container reiniciado em cada estado — o monolítico e o particionado —, o CSS
  que o Turbopack serve tem as **5.028 regras na mesma ordem**; normalizando o que o dev acrescenta
  por módulo (um cabeçalho `/* [project]/… (css) */` e uma linha vazia por arquivo importado: 6 no
  monolítico, 24 no particionado) e a linha `sourceMappingURL` (que carrega o hash do chunk, por
  construção), os dois lados dão
  `sha256 0bd4f6297e0f9f2b60db0b7ceb50e73cf9c516832209813d8e312aa6fea7bac1`.

**Medido (13/10/2026, pós-F6):** `brand.css` 5.248 → 19 linhas e 2.039 → 0 comentários;
`styles/brand/` 18 arquivos (5.265 linhas medidas — os dezoito parciais, cada um fechando em `\n`);
comentário em `frontend/src` 9.770 → **9.770**; baseline da catraca 309 → **326** arquivos (a dívida
do §15.8 muda de forma, não de tamanho); camadas intactas (R-A 3 · R-C 1 · R-E 3, todas do RV-048;
R-B e R-D 0) e convenção 0.

**Guarda que fica verde:** a catraca do comentário, reancorada no mesmo commit com o total da árvore
**igual** — a régua partiu sem acrescentar narrativa —, e os dois specs que leem a régua por caminho,
que passaram a ler o manifesto (o `ruler.spec.ts` verde: 34 arquivos/466 testes como antes).
**Gate:** `make check` · `make types` · `make test` (24 suítes/424 no backend, 9/104 no CRM, 34/466 no
storefront) · GET `/br`, `/br/store` e `/br/account` = 200, com os parciais no CSS servido (regras dos
parciais 1, 3, 17 e 18 presentes, e **zero** `@import` cru). ⚠️ O `yarn build` de produção **não
fecha** — e não por esta fase: é o RV-050, abaixo, reproduzido com a árvore limpa.
**Arquivos:** *novos:* os dezoito de `frontend/src/styles/brand/` ·
*alterados:* `frontend/src/styles/brand.css` (vira o manifesto),
`frontend/src/__checks__/ruler.spec.ts`,
`backend/src/modules/content/__tests__/assets.unit.spec.ts`,
`scripts/baselines/comments.json`, este doc e o doc 15.
**Pré-requisito:** F5
## Fase 7 — O CRM partido

O painel tinha uma tela plana: `admin/src/admin/routes/content/` com 23 arquivos na raiz — a casca da
rota, os desenhos, as regras puras e o CSS, todos irmãos —, mais três diretórios. A F7 dá a cada um
o seu lugar: `page.tsx` na raiz, o desenho em `components/`, a regra em `lib/`, o hook em `hooks/` —
e `widgets/` fica só com o entrypoint.

### ✅ F7 · O CRM partido — **FEITO** (`fd42c25831`)

**O que foi feito:**

- `routes/content/components/` (novo): os 15 `.tsx` da tela (`field-input`, `SectionRow`,
  `SurfaceSectionsPanel`, `SectionCreator`, `PageSectionsPanel`, `PageAccordionItem`,
  `PagesAccordion`, `ThemeSections`, `VitrineSections`, `pages-view`, `appearance-controls`,
  `document-input`, `image-input`, `href-input` e `OrderDirtyBar`), **mais** o `appearance.css` e a
  pasta `fonts/`. O CSS e as fontes vão com o `appearance-controls.tsx`, que é quem importa o CSS: o
  `url("./fonts/…")` do `@font-face` é relativo ao próprio CSS, então os dois só continuam
  verdadeiros se mudarem de pasta **colados**. As três famílias seguem as mesmas, e é o
  `assets.unit.spec.ts` (md5 contra o storefront) que confere.
- `routes/content/lib/` (novo): as seis regras puras — `form-draft` (a fiação do rascunho),
  `list-order` (a ordem pendente), `markdown-bar`, `navigation` (as abas e as três vistas), `types`
  (os tipos compartilhados) e `utils`. Nenhuma delas desenha: são o que se testa sem jsdom.
- `page.tsx` e `hooks/useSurfaceSections.ts` **ficam onde estavam**: a rota é a rota (o painel a
  descobre por ela), e o hook é o hook. Os specs foram colados no alvo (convenção do F3):
  `lib/__tests__/` com quatro, `components/__tests__/` com o do diálogo, e o
  `panel-wiring.unit.spec.ts` na raiz de `content/__tests__/` — a guarda dele é da **rota inteira**
  (varre `admin/src` e confere a fiação), não de um arquivo só.
- `widgets/`: **só o entrypoint**. A regra pura do enriquecimento sai de
  `widgets/enriquecimento-form.tsx` para `admin/src/admin/lib/enriquecimento-form.ts` — fora dali
  vale a extensão normal do arquivo (o `] as const` não precisa de `.tsx`, e a irmã `api-url.ts` já
  provava isso no build) —, e a pasta que o plugin do admin varre **sem filtro de nome** fica só com
  o que é widget de verdade. O cabeçalho da regra encolheu de 16 para 7 linhas: a medição do plugin
  continua (o `.ts` ali derruba o parse e o build sai verde mesmo assim), mas a aritmética do
  `getParserOptions` virou história do commit.

**A prova de que o move não tocou em nada além dos imports:** 27 arquivos movidos e **21 linhas
alteradas — todas de import**, conferidas linha a linha contra o `HEAD`: qualquer diferença que não
case com um especificador relativo aborta o script. Nenhuma linha de código, de JSX ou de narrativa
mudou de conteúdo por causa do move.

**Os leitores por caminho, um a um (é o risco que o F3 mapeou e o F6 pagou):**

- `content/__tests__/panel-wiring.unit.spec.ts` — as 9 leituras passam a nomear a árvore nova
  (`COMPONENTS` e `LIB`), de modo que a guarda de fiação passa a ser **testemunha do layout**: um
  arquivo que mude de lugar sem que a árvore mude reprova ali.
- `components/__tests__/section-creator.unit.spec.ts` — quatro para cinco níveis até `admin/src` (o
  spec desceu um), com o alvo indo para `components/SectionCreator.tsx`.
- `backend/src/modules/content/__tests__/assets.unit.spec.ts` — o leitor cruzado do CSS e das
  fontes do painel, que a F6 já tinha reancorado: as duas leituras ganham o `components`.
- citações que o próprio move tornou falsas, em comentário: o `./utils` de `SectionCreator.tsx` e de
  `SectionRow.tsx` e o `__tests__/panel-wiring…` de `lib/types.ts` (que, lido de `lib/`, apontava
  para uma pasta que não existe) — as três corrigidas no mesmo commit, sem linha nova.

**A catraca (`--write`) e o que ela viu:** os 27 caminhos novos não herdam a exceção dos antigos — o
`make check` reprovou com **81 verificações** antes do `--write` (é o mecanismo funcionando: o
baseline guarda caminho, e o caminho mudou), e a catraca foi reancorada no mesmo commit.

**Medido (13/10/2026, pós-F7):** 23 arquivos + 3 diretórios na raiz viram `page.tsx` + `hooks/` +
`lib/` (6) + `components/` (15 + o CSS + a pasta de fontes), com os specs em três `__tests__/`;
`widgets/` de 2 arquivos para 1; comentário em `admin/src` **2.030 → 2.022** e 7.098 → **7.093**
linhas (o cabeçalho que perdeu razão de ser, menos a linha que o `panel-wiring` ganhou para nomear a
árvore nova), com o baseline em 326 arquivos — a dívida do §15.8 encolhe 8 linhas por um move; o
contrato intacto (a citação do `fonts/` foi reescrita em quatro linhas, sem crescer).

**Guarda que fica verde:** `make build-admin`, o gate da fase — é o alvo que compila o painel **e**
reprova o log do plugin mesmo com exit 0. Ele fecha com `Backend build completed successfully
(80.24s)` e `Frontend build completed successfully (116.21s)`, **0** `An error occurred while` e
**0** `Rollup failed to resolve` no log, e o smoke do painel (`check-admin-modules.mjs`) confere
**300 módulos** (287 chunks do otimizador, 437 alcançados) sem nenhum 404 nem fallback de HTML.
**Gate:** `make check` · `make types` · `make test` (9 suítes/104 testes no CRM — os specs movidos
rodando nos caminhos novos — e 34/466 no storefront; o backend sem teste novo nesta fase) ·
`make build-admin` + smoke.
**Arquivos:** *movidos:* 27 (16 para `components/`, 6 para `lib/`, 5 specs para os `__tests__`
colados ao alvo, 1 regra de `widgets/` para `admin/src/admin/lib/`, mais a pasta `fonts/`) ·
*alterados:* `page.tsx`, `hooks/useSurfaceSections.ts`, `widgets/product-enrichment.tsx`,
`content/__tests__/panel-wiring.unit.spec.ts`,
`components/__tests__/section-creator.unit.spec.ts`,
`backend/src/modules/content/__tests__/assets.unit.spec.ts`,
`packages/contrato/src/contract.ts`, `scripts/baselines/comments.json`, este doc e o doc 15.
**Pré-requisito:** F6

**Pendências que a F7 deixou para o F9 (a fase das citações)** — todas **anteriores** a ela, e em
arquivo que não é árvore de fonte do CRM: `frontend/src/app/fonts/README.md:55-56` e
`backend/src/modules/content/README.md:346` (o `fonts/` e o `appearance.css` que mudaram de pasta);
`DOCUMENTACAO_REQUISITOS_ADMIN.md` (nove linhas citando `content/<arquivo>`, da linha 137 à 258); e
`docs/real-valor/12-script-enriquecimento-catalogo.md:45` (o `list-order.ts`). Já falsas **antes**
desta fase, no mesmo lote de citações: `docs/plano-centralizacao.md` (não existe; citado em
`components/field-input.tsx:54`, `lib/form-draft.ts:20` e `lib/utils.ts:15`) e
`frontend/src/lib/util/media.ts` (`components/image-input.tsx:14` — o dono é `lib/ui/media.ts` desde
a F2).

### ✅ F8 · O backend partido nos três alvos — **FEITO** (`fc3b7d77d3`)

**F7 = `fd42c25831`** — o CRM partido (27 arquivos movidos e a árvore `content/` em `page.tsx` +
`components/` + `hooks/` + `lib/`). O hash entra aqui pela mesma razão de sempre: quem commita não
carrega o próprio hash.

**Lido integralmente antes de mover (§15.5)** — a regra que a F3 e a F6 pagaram, e que nesta fase é o
que separa "cortar por linha" de "cortar por decisão":

- os **três alvos**, na íntegra: `modules/payment/mercadopago/service.ts` (828),
  `api/admin/content/route.ts` (488) e `scripts/seed.ts` (569);
- o alvo da renomeação: `api/store/custom/checkout-info/route.ts` (26) — e a confirmação de que **não
  há consumidor** (o `grep` de `frontend/`, `admin/` e `packages/` continua vazio, como o doc 08 diz);
- os irmãos que definem a **forma** de qualquer arquivo novo do módulo: `redigir.ts` (o cabeçalho com
  a decisão), `preferencia.ts`, `contexto.ts`, `cliente.ts`, `credenciais.ts`, `webhook.ts`, os dois
  `index.ts` (`pix/` e `cartao/`) e as cinco specs;
- o que **prende** os alvos por fora: `modules/content/__tests__/wiring.unit.spec.ts` (306 linhas —
  ela lê o `route.ts` como **fonte**, e é o contrato mais duro desta fase), o parágrafo "a rota é fina
  de propósito" do `content/README.md`, a tabela de arquivos do `mercadopago/README.md`, o
  `registro.unit.spec.ts` (config ⇄ classe ⇄ contrato) e, do lado das guardas, `check-comments.mjs`
  com `lib/comments.mjs` (a política que dita o **formato** do arquivo novo: cabeçalho ≤5 linhas,
  densidade ≤12%, e o total da árvore só desce) e `check-boundaries.mjs`;
- `backend/jest.config.js` e os alvos do `Makefile` — para rodar o gate sem adivinhar comando.

**O que foi feito:**

- **`mercadopago/service.ts`: 828 → 481 linhas**, e o que saiu saiu **por dono**, não por tamanho:
  - `decisao.ts` (212): as cinco checagens do webhook, na ordem, e a tradução do status em ação. O
    método do Medusa (`getWebhookActionAndData`) virou três linhas de delegação, e o `decidir`
    `protected` virou a função `acaoDoStatus`;
  - `status.ts` (55): o mapa fechado status → ação do webhook e status → sessão. São duas perguntas
    diferentes, e é por isso que o `approved` vira `captured` na sessão e não `authorized`;
  - `notificacao.ts` (40): os três leitores do corpo e dos headers (`header`, `idDoPagamento`,
    `tipoDoEvento`) — eles **localizam** o dado, não decidem nada com ele;
  - `boot.ts` (57): o log de boot numa função (`anunciarBoot`), com o `Registrador` que era o tipo
    anônimo inline do `Dependencias`;
  - `estorno.ts` (14): o texto da recusa de estorno, com a instrução de onde fazê-lo.
  O `semPii` que o `service.ts` importava **sem usar** saiu no mesmo movimento (ele é de
  `cliente.ts` desde a F6 do pagamento) — achado da leitura integral, sem item novo no doc.
- **`api/admin/content/route.ts`: 488 → 438 linhas**, com `lib/` na rota (o `lib/` que a F7 deu à
  regra do CRM, aqui para o que é da **rota** e não do módulo):
  - `lib/resposta.ts` (20): a forma `{ type, message }` das recusas — eram **doze** cópias de
    `res.status(400).json({ type: "invalid_data", message })`, com o 500 de estado gravado e o 404
    como os dois casos que não são 400;
  - `lib/gravacao.ts` (64): a curadoria, os chips e a posição de um corpo, conferidos na ordem em que
    a resposta os cobra. O `POST` e o `PATCH` tinham a mesma sequência em cópias — duas portas que
    podem passar a aceitar o que a outra recusa.
- **`scripts/seed.ts`: 569 → 87 linhas**, com o passo virando arquivo em `scripts/seed/`: `canais`
  (109), `regiao` (72), `estoque` (87), `frete` (201), `chave` (99) e `vinculo` (29, o `linkOnce` com
  o `LinkDefinition` do Medusa no lugar do `Parameters<typeof link.create>[0]`). A entrada ficou sendo
  a **lista** do que a loja precisa, na ordem, com o id de um passo atravessando para o próximo — e a
  lista passou a ter **sete** itens: o cabeçalho resumia em seis o que os comentários `// N.` do
  arquivo antigo (movidos junto com o código) sempre disseram em sete.
- **`api/store/custom/checkout-info/route.ts` → `api/store/checkout/info/route.ts`**, e o git
  registrou como **rename** (`R`). A URL pública passa de `/store/custom/checkout-info` para
  `/store/checkout/info`: o `custom/` era o nome de **exemplo** do Medusa e não dizia nada sobre o
  recurso, enquanto a convenção viva do repositório é o recurso primeiro (`store/orders/track`,
  `admin/content/order`). Saem o nível `custom/` e o diretório `checkout-info/`.

**A prova de que o corte não mudou comportamento.** Duas coisas que nenhum `tsc` alcança ficaram
presas por teste:

- **a ordem das conferências.** No admin, um corpo com dois erros recebe **o primeiro** — e a ordem é
  a mesma nas duas portas (curadoria → chips → posição) e a mesma de antes do corte; no webhook, as
  cinco checagens continuam na ordem do README. É por isso que o `resolverReferencias` recebe
  `curation`, `references` e `position` **já lidos** em vez de parsear o corpo: no `PATCH` o
  `resolveSurface` é conferido **antes** das referências, e o helper não podia passar na frente dele;
- **o módulo de pagamento tinha 96 asserções verdes antes e depois** (rodado duas vezes: no `HEAD` e
  com o corte aplicado). A suíte de 446 linhas do webhook é a que importa aqui: ela exercita o
  caminho real — 401 sem header, 401 com assinatura de outro segredo, aprovação que sela a sessão,
  `pending` do Pix que não faz nada, valor divergente, `external_reference` de outro carrinho,
  provedor fora com reentrega — com o `fetch` dublê, e nenhuma linha de teste precisou mudar.

**Os leitores por caminho, um a um** (o risco que a F3 mapeou e a F6 pagou):

- `modules/content/__tests__/wiring.unit.spec.ts` — o leitor que **morde**: ele lê o `route.ts` como
  fonte e prende sete coisas (`service.getContract()`, `schema: stored.schema`,
  `schemaVersion: stored.version`, `schemaSource: stored.source`, `order: orderFaixa(surface)`, o
  `resolveSurface(` **duas** vezes — uma por porta — e a ausência de
  `typeLabels:`/`itemFields:`/`singletonTypes:`/`surfaces:`). As sete continuam verdadeiras porque o
  corte saiu para **fora** da rota, e não através dela: o `getContract()`, o `orderFaixa(surface)` e
  as duas chamadas de `resolveSurface` ficaram exatamente onde estavam;
- `registro.unit.spec.ts` — lê o `medusa-config.ts` e as duas classes; o `service.ts` mudou de
  tamanho, não de contrato (`static identifier`, `static metodo`, `metodo` de instância e `meuId`);
- `mercadopago/README.md` e `content/README.md` — as duas tabelas ganharam as linhas novas no mesmo
  commit, e a contagem de testes do módulo (90 → 96) foi corrigida na seção de testes;
- `docs/real-valor/08-arquitetura-e-integracoes.md` — a tabela do módulo (§8.4.1.1.1) ganhou os cinco
  irmãos, e a citação da rota órfã virou `/store/checkout/info`, com a data da mudança para quem
  chegar depois;
- `docs/real-valor/15-arquitetura-modular.md` — a linha da fase (§15.6), o parágrafo e a tabela dos
  "piores arquivos" (§15.4): o `service.ts` (316/828) **saiu** da tabela, e o pior do mesmo módulo
  passa a ser o `credenciais.ts` (248/416).

**A catraca (`--write`) e o que ela viu** — e esta fase teve um achado que virou correção. Antes do
`--write`, o `make check` reprovou com **15 verificações**, em três grupos:

- **duas esperadas**: `service.ts` e `seed.ts` ficaram "frouxos" no baseline antigo (têm 195 e 58
  linhas de comentário contra 316 e 129) — apertar uma entrada frouxa é o que o `--write` faz, e é o
  sinal de que o corte levou narrativa embora;
- **treze de arquivo novo**: densidade acima de 12% ou cabeçalho acima de 5 linhas. É o comportamento
  que a F6 estabeleceu como o **correto** para um split — o arquivo novo não herda a exceção de
  ninguém —, e a narrativa medida que veio com o código entra no baseline pelo `--write` do mesmo
  commit;
- **uma que a fase corrigiu**: o **total da árvore tinha subido 118 linhas** (`backend/src: 5.233`
  contra um baseline de 5.115). Não era narrativa movida — mover não muda o total —, era prosa
  **nova**: cabeçalho de arquivo, doc de módulo e parágrafo de função explicando o que o README do
  módulo e o doc 15 já dizem. Foram **127 linhas** cortadas (o cabeçalho do `boot.ts` de 18 para 4, o
  do `decisao.ts` de 10 para 4, o doc das cinco checagens de 28 para 4 — ele é do README —, os seis
  passos do `seed/` para uma linha cada), e o total fecha em **5.106**: **nove abaixo** do baseline,
  que é o único sentido que a catraca tem.

**Medido (13/10/2026, pós-F8):** os três alvos encolheram **828 → 481**, **488 → 438** e **569 → 87**
linhas; treze arquivos novos (cinco no módulo de pagamento, dois no `lib/` da rota do admin, seis em
`scripts/seed/`), um rename e três arquivos de código alterados; `backend/src` foi de 15.987 para
16.180 linhas de fonte com o comentário em **5.115 → 5.106** (a árvore ganhou 193 linhas de código e
**perdeu** 9 de narrativa); o baseline foi de **326 para 334** arquivos; e o módulo de pagamento
ficou com o maior arquivo em 481 linhas (era 828) e o mais denso em 60% (`credenciais.ts`, anterior à
fase).

**Gate:** `make check` (as cinco guardas verdes, com o `--write` reancorado no mesmo commit) ·
`make types` (o `tsc` do backend; CRM e storefront não são tocados nesta fase) · `make test` (**24
suítes/424 testes** no backend — as 96 do pagamento entre elas — mais o jest do CRM, a convenção do
painel e o vitest do storefront) · o **smoke do pagamento** é a suíte do módulo: os cinco specs
exercitam o caminho real do webhook com o `fetch` dublê (o smoke contra o provedor pede credencial e
servidor, e não é executável aqui — fica para quem tem a conta).
**Arquivos:** *criados:* 13 (`mercadopago/{decisao,status,notificacao,estorno,boot}.ts`,
`api/admin/content/lib/{resposta,gravacao}.ts`,
`scripts/seed/{vinculo,canais,regiao,estoque,frete,chave}.ts`) · *movido:* 1
(`api/store/custom/checkout-info/route.ts` → `api/store/checkout/info/route.ts`, como rename) ·
*alterados:* `mercadopago/service.ts`, `api/admin/content/route.ts`, `scripts/seed.ts`,
`mercadopago/README.md`, `modules/content/README.md`,
`docs/real-valor/08-arquitetura-e-integracoes.md`, `docs/real-valor/15-arquitetura-modular.md`,
`scripts/baselines/comments.json` e este doc.
**Pré-requisito:** F7

**Pendências que a F8 deixou para o F9 (a fase das citações)** — todas são **citação de caminho ou de
linha que esta fase tornou falsa**, e nenhuma delas é arquivo de fonte do backend:

- `docs/real-valor/01-auditoria-projeto.md:237`, `:371-372` e `:404` — o caminho antigo
  `/store/custom/checkout-info` (é o registro da auditoria: a F9 decide se reancora ou se marca como
  histórico);
- `docs/real-valor/10-roadmap.md:390` — a pergunta sobre o `/store/custom/checkout-info`;
- `docs/real-valor/08-arquitetura-e-integracoes.md:73` (`seed.ts:212`), `:127` (`seed.ts:295-309`) e
  `:382` (`seed.ts:397-469`) — as **linhas** do `seed.ts`, que o corte invalidou (o arquivo tem 87
  linhas agora); a citação da rota foi reancorada nesta fase, as linhas não;
- `docs/real-valor/10-roadmap.md:154` (`seed.ts:397-469`) e
  `docs/real-valor/12-script-enriquecimento-catalogo.md:75` e `:158` (o passo 8 na "l. 512") — idem;
- `docs/real-valor/14-paginas-de-conteudo-no-cms.md:464` —
  `backend/src/api/admin/content/route.ts:174` (a regra continua no arquivo, mas em outra linha).

**Dívida que segue aberta no doc (não é da F8):** RV-050 (o `next build` de produção), a migração
`Migration20260929204616`, o split do `c7df56fc85` e o `git push develop` — que é o que fecha os
hashes das fases.

### ✅ F9 · As citações reancoradas — **FEITO** (`712038e90c`)

**O que foi feito:** as duas metades da fase — o doc 09 ganha o hash de cada fase, e as citações que o
lote tornou falsas foram reancoradas. Dos cinco arquivos de **fonte** tocados, as cinco linhas são
**comentário**, e trocar uma linha por uma linha não mexe na catraca: ela segue verde com o mesmo
número por arquivo.

**Os hashes:** os cabeçalhos da F7 e da F8 passam a carregar o commit de cada uma — `fd42c25831` e
`fc3b7d77d3` —, como o F0 a F6 já carregavam. A promessa "hash na entrada da F<seguinte>" fica só na
entrada da fase que ainda não tem sucessora, que é esta.

**As citações, por origem** (o critério é a fase que as tornou falsas, e não o arquivo em que elas
moram):

- **F8** (as que a fase anterior criou e listou): `01-auditoria-projeto.md` (4 — o caminho
  `/store/custom/checkout-info` em três pontos e o `seed.ts:212`), `08-arquitetura-e-integracoes.md`
  (3 — os dois `seed.ts:NNN` e o `seed.ts:397-469`, que viram `seed/regiao.ts:41`, `seed/estoque.ts:81`
  + `seed/frete.ts:40` e `seed/frete.ts:120`), `10-roadmap.md` (2), `12-script-enriquecimento-catalogo.md`
  (1 — o T1 pedia "remover o passo 8, l. 512" num arquivo que hoje tem 89 linhas: virou **feito**, sem
  as linhas que não existem mais) e `14-paginas-de-conteudo-no-cms.md` (1 — `route.ts:174` → `:168`).
- **F7** (as que a entrada daquela fase já tinha listado para cá): `DOCUMENTACAO_REQUISITOS_ADMIN.md`
  (os nove caminhos `content/<arquivo>` → `content/components/` ou `content/lib/`, mais a rota do admin
  nos trechos que a F8 encurtou — `:100-118` → `:97-118`, `:52-118` → `:49-119`, `:86-99` → `:82-96`,
  `:120-303` → `:123-282`, `:52-60` → `:56-59`, `:74-84` → `:64-81`); `frontend/src/app/fonts/README.md`
  (as duas pastas do CRM que o move criou); `backend/src/modules/content/README.md` (a pasta dos
  `.woff2` e o ponteiro do plano); `12-script-enriquecimento-catalogo.md` (o `list-order.ts`); e as
  quatro citações em **comentário de código** (`field-input.tsx`, `form-draft.ts`, `utils.ts` e
  `image-input.tsx`).
- **F2** (as que ninguém tinha listado): `14-paginas-de-conteudo-no-cms.md` citava
  `frontend/src/lib/util/media.ts` em dois pontos — é `lib/ui/media.ts` desde a F2, e o comentário do
  `image-input.tsx` repetia o caminho morto.
- **O `plano-centralizacao.md`, que não existe** (saiu no `6c7feef6e7`): era citado por três
  comentários (`field-input.tsx`, `form-draft.ts`, `utils.ts`), pelo `content/README.md` e por três
  pontos do `README.md` — que já tinha a nota sobre os dois arquivos removidos. Todos passam a apontar
  para `docs/real-valor/15-arquitetura-modular.md` (§15.2 e §15.3), e no `README.md` o mapa das 114
  asserções da guarda de paridade fica só na mensagem do commit, que é onde ele de fato está.
- **A tabela de verificação do `README.md` estava seis fases atrás**: `21 suítes / 368 testes` no
  backend e `4 / 52` no CRM viraram `24 / 424` e `9 / 104`, e o storefront, de `12 arquivos / 173` para
  `34 / 466` — medido rodando `make test` nesta fase, não copiado de outro doc.

**O que a fase NÃO mexeu, e por quê:** as citações de linha dentro dos arquivos que a F7 **moveu
inteiros** continuam válidas — o move trocou imports, não deslocou conteúdo (é a prova da própria F7:
27 arquivos, 21 linhas, todas de import). As que a F7 **editou no lugar** foram conferidas uma a uma e
reancoradas quando a linha andou: `page.tsx:135-139` → `:139-142` (o `defineRouteConfig` da rota) e
`useSurfaceSections.ts:327-344` → `:351` (o `restore`, que a F7 deslocou). E o que é **histórico** fica
onde está: as perguntas abertas da auditoria sobre `/store/orders/track` e o caminho antigo registrado
no doc 08 e na própria entrada da F8 — o registro de uma mudança é parte da mudança.

**Gate:** `make check` (as cinco guardas; a catraca segue em 334 arquivos, com o mesmo número de
comentário por arquivo em cada arquivo tocado — trocar uma linha de comentário por outra não move a
régua) · `make types` (as cinco linhas são comentário, e é isto que o `tsc` confirma) · `make test`
rodou, embora a fase não seja de código: **24 suítes/424 testes** no backend, **9/104** no CRM e
**34/466** no storefront — é de onde saem os números que o `README.md` passou a dizer.
**Arquivos:** `README.md`, `DOCUMENTACAO_REQUISITOS_ADMIN.md`, os docs 01, 08, 09, 10, 12, 14 e 15,
`frontend/src/app/fonts/README.md`, `backend/src/modules/content/README.md` e os quatro comentários de
fonte (`components/field-input.tsx`, `lib/form-draft.ts`, `lib/utils.ts`, `components/image-input.tsx`).
**Pré-requisito:** F8

### ✅ F10 · O comentário dos vinte e oito piores — **FEITO** (o hash é o commit que carrega esta entrada: a F10 é a última fase do lote, e não há entrada seguinte onde escrevê-lo)

**O que foi feito:** a política do doc 15 §15.4 (cabeçalho ≤ 5 linhas, densidade ≤ 12%) deixou de ser
só régua — ela foi aplicada aos **vinte e oito arquivos** que o `--report` apontou como os piores, e o
`--write` reancorou o baseline **no mesmo commit**, que é o que a §15.4 manda ("o `--write` é parte do
commit que mudou a forma dos arquivos de propósito"). O corte não é apagar comentário: é cortar o
**ensaio** — o bloco de 15 a 60 linhas antes de um tipo, de uma função ou de uma peça de CSS — e ficar
com a armadilha, com o dono de cada peça e com o número medido.

**Os cinco piores** (linhas de comentário, antes → depois): `contract.ts` **1.340 → 375** (72% de
corte; o arquivo perdeu 966 linhas e a densidade caiu de 51% para 22%), `schema.ts` **371 → 55**
(85%), `field-input.tsx` **327 → 133**, `defaults.ts` **257 → 70** e `credenciais.ts` **248 → 89**.
Depois deles: `order.ts` 224 → 78, `filters.ts` 216 → 80, os quatro parciais da régua (`04-trilho`
207 → 70, `01-tokens` 197 → 60, `05-card-vitrine` 158 → 54, `15-card-home` 158 → 55), `service.ts`
195 → 80, `catalog-filters.ts` 187 → 78, `ruler.spec.ts` 172 → 68, `product-carousel/index.tsx`
166 → 60, `marquee.ts` 117 → 29, `payment.ts` 95 → 20, `api-url.ts` 67 → 33, `content-section.ts`
63 → 32, `contexto.ts` 61 → 42, `motion.ts` 61 → 34, `product-fields.ts` 60 → 24, os dois links
(`content-section-product` 58 → 22, `content-section-category` 56 → 22), `seed.ts` 58 → 22,
`content-contract.ts` 47 → 28 e `api/hooks/payment/[provider]/route.ts` 47 → 18.

**Medido (13/10/2026):** **3.509 linhas de comentário a menos** no repositório — frontend
9.770 → 8.792, backend 5.106 → 4.346, CRM 2.022 → 1.794 e o pacote de contrato 2.084 → **541** (era o
mais comentado do repo). O baseline fica com **334 arquivos**, e o diff dele é a prova da fase: **0
entradas subiram, 0 nasceram, 0 ficaram órfãs** — 306 entradas intactas (os arquivos que a fase não
tocou, byte a byte) e as 28 tocadas com o número apertado em cada uma. É o que sustenta a leitura da
catraca: cortar comentário não move a régua para cima, e a folga que sobra vira número reancorado.

**A prova de que só comentário mudou** (a fase edita 28 arquivos de fonte, e o risco é o comentário
levar código junto): os 28 foram reparseados pelo `esbuild` com os **identificadores preservados** e
comparados com o `HEAD` — saída idêntica nos 28. Com o mangling ligado, dois deles divergem só nos
nomes curtos que o minificador inventa — e é essa segunda comparação que separa "mudou o código" de
"mudou o comentário". Em cima disso: `tsc` verde nos três pacotes e as três suítes com os mesmos
**424 / 104 / 466** testes de antes da fase. Vale o registro porque um `{/* ... */}` de JSX aparece
como "linha de código" numa auditoria de diff por linha: a auditoria acusou 33 linhas e o minificado
idêntico mostrou que as 33 eram prosa.

**O que a fase NÃO fez:** não perseguiu os 334 do baseline. Um arquivo pequeno com cabeçalho e linha
de campo (o `product-fields.ts` tem 30 linhas de código e 24 de comentário, 80% de densidade) fica
acima de 12% mesmo depois do corte — ali o comentário **é** a documentação do arquivo, e a exceção
declarada no baseline é a resposta honesta. A fase cortou os vinte e oito piores, não a lista
inteira, e o resto segue como dívida declarada no doc 15 §15.8.

**Gate:** `make check` (as cinco guardas verdes, com o baseline reancorado no mesmo commit) ·
`make types` · `make test` (24/424 no backend, 9/104 no CRM, 34/466 no storefront) · e o `--report`
de novo ao fim, para conferir que a cabeça da lista mudou.
**Arquivos (lidos integralmente na fase, como manda a §15.5):** 28 arquivos de fonte — 4 do contrato
(`contract.ts`, `schema.ts`, `defaults.ts`, `payment.ts`), 11 do backend (`credenciais.ts`,
`service.ts`, `order.ts`, `filters.ts`, `contexto.ts`, `content-section.ts`, `content-contract.ts`,
`content-section-product.ts`, `content-section-category.ts`, `seed.ts`,
`api/hooks/payment/[provider]/route.ts`), 11 do storefront (`catalog-filters.ts`, `marquee.ts`,
`launches.ts`, `product-fields.ts`, `motion.ts`, `product-carousel/index.tsx`, `ruler.spec.ts` e os
quatro parciais de CSS) e 2 do CRM (`api-url.ts`, `field-input.tsx`) —, mais
`scripts/baselines/comments.json`, este doc e o doc 15.
**Pré-requisito:** F9

---

### RV-050 · O `yarn build` de produção não fecha (`next/headers` no bundle de cliente) — **ABERTO**

**Descrição:** o `next build` reprova em `src/lib/medusa/locale-cookie.ts` com `You're importing a
component that needs "next/headers"` — o `next/headers` alcança um bundle **de cliente** pela cadeia
`lib/config.ts` → `lib/data/tracking.ts` → `modules/tracking/templates/index.tsx` (o `"use client"`
da cadeia). O webpack morre antes de emitir CSS, e é por isso que o gate de build da F6 não pôde ser
fechado.
**Medido (13/10/2026, na F6):** reprodutível **no HEAD da F5** — `git stash` das mudanças da F6 e
`next build` de novo dá o mesmo erro, o mesmo trace e a árvore limpa —, e a cadeia é anterior à F5:
o `lib/config.ts` já importava o `getLocaleHeader` no commit da F4. A F6 não toca em nenhum arquivo
da cadeia (só CSS e dois specs).
**Tipo:** defeito · **Prioridade:** ALTA · **Complexidade:** baixa–média
**Depende de:** nenhuma
**Arquivos:** `frontend/src/lib/config.ts`, `frontend/src/lib/data/tracking.ts`,
`frontend/src/modules/tracking/templates/index.tsx`, `frontend/src/lib/medusa/locale-cookie.ts`
**Aceite:** `next build` verde com a régua partida — a prova de concatenação da F6 já está feita nos
outros dois níveis (a fonte e o bundle do dev), e é este o gate que sobra
**Pré-requisito:** nenhum — achado na F6 e registrado aqui como manda a regra do lote (§15.6)

---

### ✅ RV-001 · Camada de abstração de pagamento — **FEITO** (`73ed719544`)

**O que foi feito:** contrato `packages/contrato/src/payment.ts` (`FulfillmentMode`, `PaymentResult`,
`PaymentCapabilities`, `InstallmentInfo`, `MANUAL_PROVIDER_ID`); `lib/payments/{types,registry,labels}.ts`;
adapters `manual`, `unsupported` e `stripe`; checkout sem nenhum import de adapter. A UI do cartão
(`card-container`) e o botão (`payment-button`) foram MOVIDOS para dentro de `adapters/stripe/` — são
UI de provedor, não do checkout.

**Descrição original:** criar `PaymentAdapter`/`PaymentResult` no contrato compartilhado, o registry no
storefront, e migrar o Stripe atual para dentro de um adapter — sem mudar a aparência.
**Tipo:** arquitetura · **Prioridade:** CRÍTICA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos (como ficaram):**
- *novos:* `packages/contrato/src/payment.ts`, `frontend/src/lib/payments/{types,registry,labels,index}.ts`,
  `adapters/{manual,unsupported}.ts`, `adapters/stripe/{index,card-container,payment-button}`
- *alterados:* `lib/constants.tsx` (perdeu o registro), `payment/index.tsx`, `payment-button/index.tsx`,
  `payment-container/index.tsx`, `payment-wrapper/index.tsx`, `order/payment-details/index.tsx`,
  `vitest.config.ts`
- *removido:* `payment-wrapper/stripe-wrapper.tsx`
**Aceite:** os 8 critérios da RV-001; `grep -r "adapters/" modules/checkout` vazio
**Pré-requisito:** nenhum

### ✅ RV-014 · Guarda de fronteira do pagamento — **FEITO** (`73ed719544`)

**O que foi feito:** `scripts/check-boundaries.mjs` ganhou uma segunda verificação — `modules/checkout/`
não importa `@lib/payments/adapters` nem `@stripe/*`. Testada nos dois sentidos: passa no código atual
e **reprova** quando se injeta um import proibido.

**Descrição original:** estender `scripts/check-boundaries.mjs` para reprovar `modules/checkout/` que importe
`lib/payments/adapters/` diretamente.
**Tipo:** arquitetura · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-001
**Arquivos:** *alterado:* `scripts/check-boundaries.mjs`
**Aceite:** um import de teste reprova; o hook de commit chama a guarda
**Pré-requisito:** RV-001

### ✅ RV-006 · Frete automático e plugável — **FEITO** (`7bdf25bf1e`)
**Descrição:** Fulfillment Provider que calcula preço por peso × região, com valores fictícios
isolados em um arquivo só.
**Tipo:** arquitetura · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos (como ficaram):**
- *novos:* `backend/src/modules/fulfillment/tabela/{tabela,service,index}.ts` + `README.md`
  + `__tests__/tabela.unit.spec.ts`
- *alterado:* `backend/medusa-config.ts` (registra o provider)
**Aceite:** os 7 critérios da RV-006
**Desvio do backlog original:** não foi criado `packages/contrato/src/shipping.ts` nem
`frontend/src/lib/shipping/`. O Medusa já entrega a abstração
(`AbstractFulfillmentProviderService` + `StoreCartShippingOption`), e o frontend não tem o que decidir.
Ver a correção em `04-requisitos-funcionais.md`.

---

### ✅ Doc 14 — Páginas de conteúdo no CMS (F1–F3a, PR1–PR7) — **FEITO** (`b1f53846db`)

**O que foi feito (7 PRs):**

| PR | Escopo | Commit |
|----|--------|--------|
| **PR1+PR2 (F1)** | 6 páginas declaradas (`sobre`, `trocas-e-devolucoes`, `privacidade`, `termos`, `contato`, `perguntas-frequentes`) + rota genérica `[slug]` + contrato→rota→sitemap | `da0ac04c5e` |
| **PR3 (F2)** | Bloco `prose` (texto longo) + campo `markdown` + barra do editor + parser | `d5fd87a501` |
| **PR3b (F2)** | Bloco `document` (PDF anexo, 25 MB) + botão de download | `eab966d071` |
| **PR4 (F2)** | Bloco `faq` (`<details>`/`<summary>`, reusa parser `markdown`) | `a8c35a1bce` |
| **PR5 (F3a)** | Campo `href` kind + lista de destinos (`/store`, `/cart`, páginas, etc.) — resolve causa-raiz do doc 13 | `d91c19b063` |
| **PR6 (F3a)** | Tela "Páginas" no CRM: estado publicada/despublicada/sem blocos + atalho "Editar blocos" | `e43071dcb4` |
| **PR7 (F3a)** | Descoberta: páginas no rodapé (coluna `pages`), índice público `/paginas`, sugestão no 404, `sitemap` usa mesmo leitor | `b1f53846db` |

**Arquivos principais:**
- *contrato:* `packages/contrato/src/contract.ts` (`CONTENT_SURFACES`, `PAGE_SURFACES`, `CONTENT_DESTINATIONS`, `pageState`, `publishedSections`)
- *backend:* `src/modules/content/{contract,pages,payload,validation}.ts`, `src/api/admin/content/pages/route.ts`, `src/api/store/content/pages/route.ts`
- *CRM:* `src/admin/routes/content/{pages-view.tsx,page.tsx,markdown-bar.ts,href-input.tsx,document-input.tsx,image-input.tsx,field-input.tsx}`
- *storefront:* `src/app/[countryCode]/(main)/[slug]/page.tsx`, `src/app/[countryCode]/(main)/paginas/page.tsx`, `src/app/[countryCode]/(main)/not-found.tsx`, `src/lib/data/{pages,content}.ts`, `src/lib/content/page-seo.ts`, `src/modules/content/{prose,faq,render-section}.tsx`, `src/modules/layout/components/footer-column/index.tsx`
- *testes:* `page-surfaces.spec.ts` (19 testes), `pages.unit.spec.ts`, `panel-wiring.unit.spec.ts`, `prose.spec.tsx`, `faq.spec.tsx`

**Aceite:** todos os gates verdes (`make types`/`test`/`check`/`check-schema`); 6 páginas declaradas; 3 blocos novos; seletor de destinos no CRM; descoberta em 4 pontas (rodapé, índice, 404, sitemap) com **uma** leitura (`getLivePages` → `GET /store/content/pages`); sem fallback de página vazia para home.

**O que **não** foi feito (gatilho — §14.6.4):** entidade `content_page` (criar/renomear/publicar página inteira no CRM) — só entra se: (1) página pediu PR de dev 2× seguidas, (2) > 8 páginas, ou (3) lojista pede autonomia total. Nenhum gatilho apareceu.

### RV-048 · Remoção do código Stripe
**Descrição:** apagar o que sobrou do Stripe no frontend, depois que o MP estiver funcionando.
**Tipo:** refatoração · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** **RV-002** (só depois que o MP estiver valendo)
**Arquivos a remover:**
- `frontend/src/modules/checkout/components/payment-wrapper/index.tsx`
- `frontend/src/modules/checkout/components/payment-wrapper/stripe-wrapper.tsx`
- `@stripe/react-stripe-js`, `@stripe/stripe-js` (do `frontend/package.json`)

**Arquivos a alterar:**
- `payment-container/index.tsx` — remover `StripeCardContainer`, manter o wrapper
- `payment-button/index.tsx` — já reescrito pelo RV-002
- ~~`lib/constants.tsx`~~ — **saiu inteiro na F1**: o RV-001 já tinha tirado o registro de pagamento (`paymentInfoMap`, `isStripeLike`, `isPaypal`) e sobrara só `noDivisionCurrencies`, sem um único consumidor
- `order/payment-details/index.tsx` — remover o `card_last4` (não existe no MP)

**Aceite:**
1. `grep -ri stripe frontend/src` não retorna nada.
2. `frontend/package.json` sem `@stripe/*`.
3. `npm run build` e `make test` verdes.
4. Nenhuma referência a `NEXT_PUBLIC_STRIPE_KEY` (já removida do ambiente).

> **Regra de ordem — não remover antes do RV-002.** A configuração já saiu (`NEXT_PUBLIC_STRIPE_KEY` não
> é mais fornecida, o que faz o `stripePromise` ser `null` e o `PaymentWrapper` cair no ramo
> não-Stripe — o mesmo comportamento de hoje, já que nenhum provider estava registrado). Mas apagar os
> arquivos **criaria uma janela sem nenhum caminho de pagamento**. A remoção vem junto com o adapter do
> MP, para que cada etapa tenha um pagamento funcionando.

---

### ✅ RV-014 · Guarda de fronteira do pagamento — **FEITO**

**O que foi feito:** `scripts/check-boundaries.mjs` ganhou uma segunda verificação — `modules/checkout/`
não importa `@lib/payments/adapters` nem `@stripe/*`. Testada nos dois sentidos: passa no código atual
e **reprova** quando se injeta um import proibido.

**Descrição original:** estender `scripts/check-boundaries.mjs` para reprovar `modules/checkout/` que importe
`lib/payments/adapters/` diretamente.
**Tipo:** arquitetura · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-001
**Arquivos:** *alterado:* `scripts/check-boundaries.mjs`
**Aceite:** um import de teste reprova; o hook de commit chama a guarda
**Pré-requisito:** RV-001

### ~~RV-015 · Stop-gap de pagamento~~ — CANCELADO

> **Cancelado durante o planejamento.** Este item previa registrar o Stripe como venda temporária
> enquanto o Mercado Pago não existisse. **Não será feito**, por três motivos verificados:
>
> 1. **O Stripe não atende o parcelamento** da forma necessária para o mercado brasileiro.
> 2. **Seu código não serve para o MP.** A integração do Stripe é *tokenização de cartão*
>    (`CardElement`, `useStripe`), e o MP é *redirecionamento* (`preference` → `init_point`). Não há
>    sobreposição — configurar o Stripe não antecipa nada do MP.
> 3. **O custo não é "poucas linhas".** `@medusajs/payment-stripe` não está declarado no
>    `backend/package.json` (está no `node_modules` só por hoist transitivo), faltaria
>    `STRIPE_SECRET_KEY`, migration e teste de compra real — meio dia de trabalho por um resultado
>    que só paga Pix.
>
> **Consequência:** a loja não terá rede de segurança entre o RV-001 e o RV-002. Se o Mercado Pago
> estourar o prazo, **não há venda** — decisão consciente, registrada em `03-gap-analysis.md`,
> seção 3.3.
>
> **Remanescentes do Stripe que ficam para o RV-002:** `NEXT_PUBLIC_STRIPE_KEY` já foi removida do
> `.env.example`, do `docker-compose.yml` e do `.env`. O **código do frontend segue intacto** por
> decisão — removê-lo agora criaria uma janela sem nenhum caminho de pagamento. A remoção completa
> (7 arquivos + `@stripe/react-stripe-js` + `@stripe/stripe-js`) acontece **junto com o adapter do
> MP**, para que cada etapa tenha um pagamento funcionando.

---

## Fase 1 — Essencial para a inauguração

### ✅ RV-003 · Interface 100% pt-BR — **FEITO** (`316be39e46`)

**O escopo real foi maior que o registrado:** a tabela do requisito previa 19 itens; o levantamento
sistemático achou **35 arquivos e 127 strings**. As labels de formulário (15 em endereço e
cobrança), os textos de conta (17), os metadados (17) e a ordenação não estavam na tabela.

**Mensagens ficaram acionáveis, não literais:** "Enter a valid email address" → **"Informe um
e-mail válido"** (o original só diz que falhou); "Welcome back" → **"Bem-vinda de volta"** (com "a",
coerente com o tom da marca).

**Ficou para o RV-007 (SEO), que é outro requisito:** os títulos de produto, categoria e coleção
ainda vazam " | Medusa Store" — é vazamento de marca do template, não de idioma, e misturar os dois
tornaria a revisão mais difícil.

**Descrição original:** substituir todos os textos em inglês verificados na RV-003.
**Tipo:** UI · **Prioridade:** CRÍTICA · **Complexidade:** baixa
**Depende de:** nenhuma — **pode começar hoje**
**Arquivos:** 8 páginas + 5 componentes (tabela da RV-003)
**Aceite:** os 5 critérios da RV-003
**Pré-requisito:** nenhum

### ✅ RV-002 · Adapter Mercado Pago — **FEITO** (`82a4738d42`)

> **Estado verificado em 10/02/2026 — o inverso do que este item dizia.** As três verificações que
> davam "Não" agora dão "Sim":
>
> | Verificação | Antes | Agora |
> | :--- | :--- | :--- |
> | `backend/medusa-config.ts` registra módulo de pagamento? | Não — só `file` e `content` | **Sim** — `@medusajs/medusa/payment` com `./modules/payment/mercadopago/{pix,cartao}` |
> | `lib/payments/registry.ts` tem o adapter do MP? | Não — só `stripe`, `manual`, `unsupported` | **Sim** — os dois do MP, e **primeiro** na ordem do array |
> | Backend tem dependência do Mercado Pago? | Não | **Sim** |
>
> **O que a implementação descobriu** — e que mudou decisões deste documento — está em
> `08-arquitetura-e-integracoes.md` 8.4.1.1.1 e no `README.md` do módulo. Os três que mais importam:
>
> 1. **A idempotência não precisou ser construída.** Este item previa uma marca nossa em
>    `order.metadata`. Ela seria uma segunda fonte de verdade para uma pergunta que o Medusa já
>    responde: `capturePayment_`, `completeCartAfterPaymentStep` e o ramo de autocapture já são
>    guardados. A proposta anterior do `04` foi **corrigida**, não implementada.
> 2. **O prefixo `APP_USR-` NÃO diz se o token é de teste.** Só `TEST-` é inequívoco, e a ausência
>    dele **não** prova produção. Daí `MP_AMBIENTE` ser **declarado** em vez de deduzido, e o
>    provider **recusar** a combinação perigosa (`producao` + `TEST-`) em vez de só avisar.
> 3. **O loader do `payment` SOMA os providers; o do `fulfillment` SUBSTITUI.** É a diferença que
>    decidiu a forma do `medusa-config.ts` — e o motivo de existirem **dois** módulos (`pix` e
>    `cartao`): o `id` do registro vem do item do config, então dois services num só
>    `ModuleProvider` sobrescreveriam um ao outro.
>
> **Uma armadilha silenciosa, que agora tem teste.** O `resolvePayment` casa primeiro pelo id
> **exato** e só depois por `startsWith`. Por isso os dois adapters do MP declaram o `provider_id`
> **completo** (`pp_mercadopago_pix`, `pp_mercadopago_cartao`): se um declarasse `pp_mercadopago_`,
> capturaria os dois e o segundo nunca seria alcançado — o `for` para no primeiro que casa.
>
> **Verificação:** 368 testes unitários em 21 suítes (backend), 173 no storefront, `tsc --noEmit`
> limpo nos dois runtimes, `check-boundaries` em dia.
>
> **O que NÃO está verificado — e é justamente o que este item dizia importar mais.** A assinatura é
> testada contra o **algoritmo** do provedor (um helper assina o manifesto como o MP assina, nas duas
> variantes, com e sem `request-id`), **não** contra uma notificação **real**: nenhuma chegou ainda.
> Enquanto isso não acontecer, "a integração funciona" não tem prova — tem teste unitário. O roteiro
> do teste real está em `11-ambiente-local.md` §11.6.
>
> **O que ainda depende de você (não do código):**
> 1. `MP_NOTIFICATION_URL` → `https://<túnel>/webhooks/mercadopago`. Hoje aponta para `webhook.site`,
>    que **captura a notificação e engole a venda** — o log de boot avisa, e é para avisar.
> 2. `MP_BACK_URL` → `https://<túnel>/br/pedido/confirmacao`.
> 3. `INTERNAL_API_SECRET` — **não é urgente**: vazio, a rota interna é fail-closed (404), e há teste
>    que o prova. É o caso em que "não configurado" erra para o lado seguro.
>
> **Sequência agora:** **RV-042** (captura e reserva) é o próximo elo — mas **releia o item antes de
> começar**: parte do que ele previa (um workflow `create-order-from-payment` e um subscriber que
> cria o pedido) já não é o caminho, porque o pedido nasce no próprio webhook, em
> `processPaymentWorkflow` → `completeCartWorkflow` (ver `04`). O **RV-048** (remover o Stripe) só
> depois que o MP estiver valendo.

**Descrição original:** provider do MP no backend com Pix, cartão parcelado e boleto; webhook com assinatura e
idempotência; adapter no frontend.
**Tipo:** integração · **Prioridade:** CRÍTICA · **Complexidade:** alta
**Depende de:** RV-001
**Arquivos:** ver 8.2
**Aceite:** os 7 critérios da RV-002
**Pré-requisito:** credenciais do MP; **modalidade decidida**; URL pública do webhook

### RV-004 · Filtros de catálogo
**Descrição:** facetas de cor, tamanho, preço e disponibilidade com contagem, na query string, com
drawer no mobile.
**Tipo:** funcional + UX · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-003 (rótulos)
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-004
**Pré-requisito:** catálogo com opções de tamanho e cor cadastradas

### RV-005 · Busca de produtos
**Descrição:** campo no header com sugestões, e página de resultado reaproveitando `PaginatedProducts`.
**Tipo:** funcional + UX · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-003
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-005
**Pré-requisito:** títulos de produto bem cadastrados (a qualidade da busca depende disso)

### RV-007 · Metadados de SEO
**Descrição:** remover "Medusa Store" dos títulos, escrever descrições reais, criar sitemap, robots e
JSON-LD.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-003 (as descrições são em pt-BR)
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-007
**Pré-requisito:** nenhum

### RV-008 · Parcelamento e Pix na vitrine
**Descrição:** linha de parcelamento no card e no resumo, alimentada pelo adapter.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-001, RV-002
**Arquivos:** *alterados:* `product-preview/price.tsx`; *novos:*
`payment/components/installment-info.tsx`
**Aceite:** os 4 critérios da RV-008
**Pré-requisito:** RV-002

### RV-009 · Guia de medidas
**Descrição:** tabela em `metadata` do produto, link ao lado do seletor, página de guia geral.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** ver 8.2
**Aceite:** os 4 critérios da RV-009
**Pré-requisito:** **decisão de modelagem** (metadata × módulo)

### RV-016 · Badge de desconto e tamanhos no card
**Descrição:** badge de % real e chips de tamanho informativos.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `product-preview/index.tsx`; *novos:* `discount-badge.tsx`, `size-chips.tsx`
**Aceite:** os 3 critérios da RV-011
**Pré-requisito:** `get-percentage-diff` já existe

### ✅ RV-017 · Tokens de estado, escala tipográfica e `reduced-motion` — **FEITO** (`325dafa850`)

**2 das 3 lacunas fechadas; a terceira estava errada na auditoria.**

Fechadas: **9 tokens** de escala tipográfica e **8** de cores de estado. A escala é a **mesma** dos
utilitários que já eram usados (trocar o token pelo utilitário não move um pixel) — o que muda é ter
nome: `--rv-text-2xl` diz "título de seção"; `text-2xl` não diz nada.

`--rv-info` **reaproveita o cacau** em vez de introduzir azul: um azul quebraria a paleta terrosa e
cairia no clichê de interface corporativa que a marca evita.

**Contraste medido (WCAG 2.1):** danger 6.10, info 9.72, success 5.12, warning 4.80 — todos acima
de AA para texto normal. O verde e o âmbar começaram mais claros e foram **escurecidos** até passar
(`#4a7c59` dava 4.33 e `#a8752a` dava 3.57). Escurecer é melhor do que documentar a limitação.

**Correção:** o `prefers-reduced-motion` foi escrito na auditoria como lacuna, e **não era** — o
`brand.css` já tinha o bloco (linha 1130), e ele é **melhor** do que a proposta que eu faria: tem
tratamento próprio para o ticker, porque o piso global pararia o trilho no fim do curso com a última
mensagem fora da tela. Deixado como estava.

**Descrição original:** fechar as três lacunas do design system (cores de estado, escala tipográfica,
`prefers-reduced-motion`).
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterado:* `frontend/src/styles/brand.css`
**Aceite:** nenhum componente novo usa cor literal ou tamanho solto
**Pré-requisito:** nenhum
**Nota:** fazer **antes** dos componentes da Fase 1, não depois — evita retrabalho.

### RV-018 · Documentação e correção do README
**Descrição:** manter `docs/real-valor/` e corrigir a tabela de documentação do README, que aponta para
6 arquivos removidos.
**Tipo:** documentação · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `README.md` (linhas 283–291)
**Aceite:** nenhum link quebrado na tabela de documentação
**Pré-requisito:** nenhum

### RV-042 · Captura do pagamento e reserva de estoque
**Descrição:** quando o MP aprovar, criar o pedido no Medusa e reservar o estoque. `rejected`/
`cancelled` liberam. Idempotente por `payment_id`.
**Tipo:** funcional + backend · **Prioridade:** CRÍTICA · **Complexidade:** média
**Depende de:** RV-002
**Arquivos:** *novos:* `backend/src/workflows/create-order-from-payment/`,
`backend/src/subscribers/mercadopago-payment-updated.ts`
**Aceite:** os 5 critérios da RV-042
**Pré-requisito:** RV-002
**Nota:** `backend/src/workflows/` **não existe** — é código novo, não adaptação.

### ✅ RV-043 · Painel de envio (registro de rastreio) — **CONCLUÍDO (10/02/2026)**

**Descrição:** campo no Admin para gravar `carrier`, `tracking_number`, `tracking_url` e
`status_label` em `order.metadata`. **Campos em texto livre, sem lista de transportadoras.**
**Tipo:** funcional + CMS · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** nenhuma · **Independe da transportadora: SIM**
**Arquivos:** *novo:* extensão no `admin/` ou campo no Admin do Medusa
**Aceite:** os 5 critérios da RV-043
**Nota:** a rota de track **já existe e funciona**; falta quem escreve. Sem este item, a cliente
consulta e vê `null`.

**Entregue:**
- `backend/src/modules/shipping/tracking.ts` — a regra pura (normalizar, deduzir link, validar).
  A validação mora aqui e não na rota, porque é a parte testável sem I/O.
- `backend/src/api/admin/shipping/route.ts` — a fila de envio, do mais antigo para o mais novo.
- `backend/src/api/admin/shipping/[id]/route.ts` — grava o registro.
- `admin/src/admin/routes/shipping/` — a tela (fila, formulário) + `envio-form.ts`.
- **23 testes** no backend e **13** no CRM.

**Três decisões que valem lembrar:**
1. **`metadata` é MESCLADO, nunca substituído.** Ele também guarda o CPF e o e-mail que a rota de
   rastreio usa para validar a identidade; regravar o objeto inteiro faria **toda** consulta de
   cliente virar 403. Há teste para isso.
2. **Ausente ≠ vazio.** Ausente é "não mexe" e vazio é "limpa" — é o que permite corrigir a
   transportadora sem redigitar o código.
3. **Link só é deduzido quando o lojista não digita** e o formato casa com um padrão conhecido
   (Correios, Jadlog, Totvs). Formato desconhecido devolve `null`: um link errado leva a cliente a
   uma página de erro em outro domínio. O campo continua texto livre, então o RV-046 (adapter de
   transportadora) entra sem retrabalho.

**Defeito encontrado pelos testes:** o rótulo da fila comparava só o prefixo `entreg`, e classificava
"Saiu para entrega" e "Em rota de entrega" como **entregues** — a tela affirmaria à loja que a
cliente já recebeu o pedido. Corrigido para a palavra inteira, com teste de regressão.

### ✅ RV-044 · Página pública de rastreio — **CONCLUÍDO (10/02/2026)**

**Descrição:** tela `/rastreio` consumindo `GET /store/orders/track`, sem login, com linha do tempo e
link no rodapé.
**Tipo:** funcional + UI · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-043 · **Independe da transportadora: SIM**
**Arquivos:** *novos:* `app/[countryCode]/(main)/rastreio/page.tsx`,
`modules/order/components/track-{form,timeline}.tsx`
**Aceite:** os 5 critérios da RV-044
**Nota:** a rota já valida identidade com **403** — a tela deve respeitar esse contrato.

**Entregue:**
- `frontend/src/app/[countryCode]/(main)/rastreio/page.tsx` — rota **pt-BR** (`/rastreio`, como
  `/carrinho` e `/conta`), não `/track` como a API.
- `frontend/src/modules/tracking/templates/index.tsx` — o formulário e os quatro estados.
- `frontend/src/lib/data/tracking.ts` — traduz a resposta HTTP em situação de tela. `no-store`.
- **12 testes** no storefront.

**O link do rodapé (pendência fechada em 10/02/2026).** A rota existia, mas **ninguém conseguia chegar
até ela** — uma tela que não se alcança não serve para nada, e "onde está o meu pedido" é justamente o
que a cliente procura depois da confirmação. O link foi para a coluna **"Ajuda"** em
`DEFAULT_HOME_SECTIONS` (`packages/contrato/src/defaults.ts`) — coluna que o PR2 do doc 14 substituiu por
**"Atendimento"**, onde o mesmo link seguiu (14.16 do doc 14).

O lugar certo **não** era o JSX do rodapé: as colunas são conteúdo editável pelo admin, e escrever o
link em JSX faria a loja precisar de deploy para renomear ou remover um link do próprio rodapé. Como
conteúdo, a loja edita, move ou apaga no painel. O `nav-link` já resolve rota interna, e por isso o
link é escrito `/rastreio` (pt-BR, como `/carrinho` e `/conta`) e não `/track`.

**Três decisões que valem lembrar:**
1. **A página não busca nada no servidor.** É um server component que só entrega o formulário; a
   consulta acontece quando a cliente aperta o botão. Se a busca fosse no servidor, o **CPF iria
   para os `searchParams`**, para o log do servidor e para o histórico do navegador.
2. **`cache: "no-store"` é a garantia central da rota.** É a única função do storefront sem cache:
   todas as outras respostas são públicas, esta tem o CPF da cliente dentro. Com qualquer cache, uma
   consulta poderia ser servida para outra pessoa. Há teste conferindo o `no-store`.
3. **"Não encontrado" e "recusado" são mensagens diferentes.** A 403 **existe** e não muda o status
   no Medusa — a cliente digitou errado, e a tela precisa dizer o que conferir, não sugerir que
   algo quebrou. "Pendente" também é um estado de primeira classe: pedido pago, envio ainda não
   registrado.

**Acessibilidade:** o resultado está em `aria-live="polite"` — sem ele, quem usa leitor de tela
pressiona o botão e não recebe nenhuma confirmação de que a página respondeu. Os três campos têm
`<label>` ligado por `htmlFor`, e o botão desabilita durante a consulta para impedir envio duplo.

### RV-045 · Notificação de envio à cliente
**Descrição:** e-mail com o código quando o admin salva o rastreio pela primeira vez.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-043 · **Independe da transportadora: SIM**
**Arquivos:** *novos:* subscriber de notificação de envio
**Aceite:** os 3 critérios da RV-045
**Pré-requisito:** **provider de e-mail transacional** (ver 8.4.4 — não auditado)

### RV-046 · Adapter de transportadora
**Descrição:** substituir o `manual` por cálculo real de frete. **BLOQUEADO** — provedor não definido.
**Tipo:** integração · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** **decisão comercial**
**Arquivos:** *novos:* `backend/src/modules/shipping/<transportadora>/`
**Aceite:** os 3 critérios da RV-046
**Nota:** o contrato (`packages/contrato/src/shipping.ts`) já está definido no RV-006 — plugar é
escrever o adapter, não redesenhar. **Não entra no caminho crítico da inauguração.**

---

## Fase 2 — Refinamento visual e UX

### ✅ RV-047 · Redesenho da vitrine conforme a referência de layout — **FEITO** (`244910fa29`, `f2adfbe74c`, `eb542c13dc`)

**Descrição:** portar o protótipo `Redesign clothing store UI.zip` como o desenho da loja — vitrine
(capa, vantagens, trilho de lançamentos, coleções em degrau, manifesto e a faixa `banner`), o card de
produto, o catálogo (barra de ferramentas + **5 facetas** de filtro), a PDP, o carrinho, o checkout, a
conta e a **busca** (`/search?q=…`, que não existia).

**Tipo:** UI **e** funcional — a busca e os filtros são entregas novas, não só desenho ·
**Prioridade:** ALTA · **Complexidade:** alta

**Entregue em três commits:**

- `f2adfbe74c` — o **contrato**: o tipo `banner` (`BannerSection`), a nota da capa (`HeroSection.note`)
  e o realce do título no `editorial` (`eyebrow`, `titleEmphasis`). A home vai a **11 tipos de seção**,
  e o `switch` exaustivo da loja ganha o `case` que o `assertNever` já exigia;
- `244910fa29` — o **storefront** (106 arquivos): `brand.css`, as bandas da home, o card
  compartilhado (que aparece em 7 lugares, incluindo os três skeletons), as telas internas e a busca;
- `eb542c13dc` — a **régua das duas seções editoriais**: o desenho sai do `className` e vira
  `.rv-callout-*` / `.rv-manifesto-*`, com os dois testes novos do `ruler.spec.ts`.

**Aceite:** `make check`, `make types`, `make test` (**790** testes: 386 backend · 70 CRM · 334
storefront) e `next build` limpos. As seções foram medidas a 1440/768/390 contra a régua (altura da
capa, véu, colunas, degrau do trilho e das coleções), e o refactor das duas seções editoriais sai
**byte a byte idêntico** (`cmp`) nas capturas de antes e depois.

**Ficou de fora, de propósito:** o coração de favorito e a linha de parcelamento **no card**. Não há
lista de favoritos na loja, e a condição de parcelamento só chega pelo meio de pagamento — desenhar
qualquer um dos dois seria a loja prometendo o que não tem.

### RV-010 · Calculadora de frete na PDP
**Descrição:** campo de CEP com cálculo de custo e prazo na página de produto.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** RV-006
**Arquivos:** *novo:* `products/components/shipping-calculator.tsx`
**Aceite:** os 3 critérios da RV-010 · **Pré-requisito:** RV-006

### RV-013 · Ordenação e rótulos do catálogo
**Descrição:** adicionar "Mais vendidos" e "Maior desconto"; rótulos pt-BR; seletor compacto no mobile.
**Tipo:** UX · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** RV-003
**Arquivos:** *alterados:* `sort-products/index.tsx`, `lib/data/products.ts`
**Aceite:** os 4 critérios da RV-013 · **Pré-requisito:** nenhum

### RV-019 · Acessibilidade — foco e rótulos
**Descrição:** auditar foco visível, `aria-label` em botões de ícone, `alt` nas imagens, `aria-live` no
carrinho, `aria-expanded` nos accordions.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-004, RV-005 (os controles novos entram já corretos)
**Arquivos:** transversal
**Aceite:** axe-core sem violações críticas; contraste do botão primário verificado

### RV-020 · Exceções de carrinho
**Descrição:** limitar quantidade pelo estoque no `cart-item-select`; tratar sessão expirada com
retorno; revalidar e avisar alteração de preço.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *alterados:* `cart/components/cart-item-select/`, `lib/data/cart.ts`
**Aceite:** os cenários 7, 9 e 10 de `07-fluxos-de-usuario.md`

### RV-012 · Newsletter
**Descrição:** novo tipo de seção no contrato, com consentimento LGPD.
**Tipo:** funcional + CMS · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-003
**Arquivos:** *novos:* campo no contrato + tipo de seção; *alterados:* `page.tsx` (registro), `footer`
**Aceite:** os 4 critérios da RV-012
**Pré-requisito:** **escolha do serviço de e-mail (comercial)**

### RV-021 · Logo vetorial
**Descrição:** substituir o wordmark em texto pelo logo oficial, quando disponível.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `layout/templates/nav/index.tsx:48-60`
**Aceite:** logo renderizado em SVG, com `alt` e Favicon atualizado
**Pré-requisito:** **logo vetorial definitivo (marca)**

### RV-022 · Ordenação dos relacionados
**Descrição:** ajustar o critério de produtos relacionados para complementaridade.
**Tipo:** funcional · **Prioridade:** BAIXA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `products/components/related-products/`
**Aceite:** relacionados da mesma categoria aparecem primeiro

---

## Fase 3 — Performance, SEO e acessibilidade

### RV-023 · Armazenamento S3 + CDN
**Descrição:** trocar `@medusajs/file-local` por `@medusajs/file-s3`.
**Tipo:** infraestrutura · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *alterados:* `backend/medusa-config.ts`, `docker-compose.yml`, `.env.example`
**Aceite:** imagens servidas por CDN; **nenhum conteúdo migrado** (só o provider)
**Pré-requisito:** bucket criado; credenciais

### RV-024 · Validação de upload
**Descrição:** validar tipo e tamanho no upload de imagem do CMS.
**Tipo:** segurança · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `admin/…/image-input.tsx`, rota de upload do backend
**Aceite:** arquivo acima do limite ou de tipo não permitido é rejeitado

### RV-025 · Rate limiting
**Descrição:** limitar requisições em rotas sensíveis (login, busca, webhook).
**Tipo:** segurança · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *novos:* middleware no backend
**Aceite:** requisições acima do limite respondem 429

### RV-026 · Analytics e funil
**Descrição:** registrar `@medusajs/analytics` e medir conversão, abandono por etapa e busca sem
resultado.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-005
**Arquivos:** *alterados:* `backend/medusa-config.ts`, storefront
**Aceite:** eventos de funil visíveis

### RV-027 · Auditoria de acessibilidade completa
**Descrição:** revisão por teclado de toda a jornada, em iOS e desktop.
**Tipo:** UI · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** RV-019
**Arquivos:** transversal
**Aceite:** jornada completa operável por teclado

### RV-028 · Teste E2E da compra
**Descrição:** teste automatizado do fluxo do clique ao pedido confirmado.
**Tipo:** qualidade · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** RV-002
**Arquivos:** *novos:* suíte E2E
**Aceite:** fluxo verde em CI

### RV-029 · Recuperação dos documentos removidos
**Descrição:** avaliar recuperar `docs/DEBITO-TECNICO.md` e `docs/plano-centralizacao.md` do histórico
Git, se o conteúdo ainda for válido.
**Tipo:** documentação · **Prioridade:** BAIXA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *novos:* sob `docs/`
**Aceite:** README referencia apenas arquivos existentes

---

## Fase 4 — Melhorias futuras

| ID | Título | Tipo | Complexidade |
| :--- | :--- | :--- | :--- |
| RV-030 | Lista de desejos (wishlist) | funcional | alta |
| RV-031 | Produtos vistos recentemente | funcional | baixa |
| RV-032 | Comparação de peças | funcional | alta |
| RV-033 | Integração com WhatsApp | integração | baixa |
| RV-034 | Programa de fidelidade / cupom por indicação | funcional | alta |
| RV-035 | Índice de busca dedicado (Algolia/Typesense) | infraestrutura | média |
| RV-036 | Multi-idioma (en-US) | funcional | alta |
| RV-037 | Troca de senha do cliente | funcional | média |
| RV-038 | Checkout em etapas com indicador de progresso | UX | média |
| RV-039 | Provedor adicional de pagamento (Stripe, PagSeguro) | integração | média |
| RV-041 | Painel de pedidos com métricas | CMS | alta |
| RV-047 | Integração com gateway de frete na API (opção B) | integração | média |

> **Sobre o frete na Fase 4:** o plug-in da transportadora é o **RV-046** (Fase 1, BAIXA, bloqueado por
> decisão comercial). O **RV-047** aqui é a *opção B* — consultar a API da transportadora para atualizar
> o status automaticamente, que só faz sentido com volume que justifique. A rota de rastreio **já aceita
> a opção A** (link), que é a recomendação para a inauguração.

---

## 9.10 Resumo quantitativo

| Fase | Itens | CRÍTICA | ALTA | MÉDIA | BAIXA | **Feitos** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Fase 0 | 4 | 1 | 3 | 0 | 0 | **3** (RV-001, RV-006, RV-014) |
| Fase 1 | 15 | 3 | 9 | 3 | 0 | **5** (RV-002, RV-003, RV-017, RV-043, RV-044) |
| Fase 2 | 8 | 0 | 1 | 5 | 2 | **1** (RV-047) |
| Fase 3 | 7 | 0 | 0 | 4 | 3 | 0 |
| Fase 4 | 12 | 0 | 0 | 0 | 12 | 0 |
| **Total** | **46** | **4** | **13** | **12** | **17** | **9** |

> **Um item cancelado:** o RV-015 (stop-gap com Stripe) saiu do backlog — ver a seção dele. Ele
> **não** está contado nas linhas acima: a linha "Fase 0" já reflete a lista publicada sem ele, e o
> efetivo é **46 itens**, não 47. (Esta tabela estava somando errado antes do RV-002: dizia 2 feitos
> na Fase 0, com o RV-006 também pronto, e 2 na Fase 1, com RV-043 e RV-044 prontos.)

---

### ✅ Entregável extra não contado na tabela: **Doc 14 — Páginas de conteúdo no CMS (F1–F3a)**

| Fase Doc 14 | PRs | Escopo | Commits |
|-------------|-----|--------|---------|
| **F1** (declarar) | PR1+PR2 | 6 páginas, rota `[slug]`, contrato→rota→sitemap | `da0ac04c5e` |
| **F2** (blocos) | PR3, PR3b, PR4 | `prose`, `document`, `faq` | `d5fd87a501`, `eab966d071`, `a8c35a1bce` |
| **F3a** (autonomia sem migration) | PR5, PR6, PR7 | seletor `href`, tela "Páginas", descoberta (rodapé, índice, 404, sitemap) | `d91c19b063`, `e43071dcb4`, `b1f53846db` |

**Total Doc 14:** **7 PRs**, todos os gates verdes, **F3b (entidade `content_page`) segue com gatilho** (§14.6.4).

**Complexidade da Fase 0 + Fase 1 (entregável da inauguração):** 19 itens, sendo 4 de complexidade
alta. É o escopo mínimo para abrir a loja vendendo, **com pagamento, reserva de estoque, envio e
rastreio funcionando** — sem depender da escolha da transportadora.

### Bloco de pedido e envio — impacto no escopo

| Requisito | Prioridade | Depende da transportadora |
| :--- | :--- | :--- |
| RV-042 Captura e reserva | CRÍTICA | Não |
| RV-043 Painel de envio | ALTA | Não |
| RV-044 Página de rastreio | ALTA | Não |
| RV-045 Notificação de envio | MÉDIA | Não |
| RV-006 Frete automático | ALTA | **Não — ✅ feito** |
| RV-046 Transportadora real | BAIXA | **Sim — bloqueado** |

**Cinco dos seis independem da transportadora.** O RV-006 (frete automático) ficou resolvido sem
esperar ninguém: o provider `tabela` calcula preço por peso × região hoje, e a transportadora real
entra depois como **outro** provider, sem tocar em carrinho, checkout, painel de envio ou `/rastreio`.
Só o RV-046 espera a decisão comercial — e o `fulfillment-manual` seedado mantém a loja vendável até lá.

Ver `10-roadmap.md` para a ordem de execução.