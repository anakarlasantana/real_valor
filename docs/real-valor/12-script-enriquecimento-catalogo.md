# 12 — Script de execução: catálogo pelo admin, card de exposição e página de produto

> **Como usar.** Isto é um roteiro de execução, não um plano de intenção. Cada tarefa tem
> objetivo, arquivos, regras, aceite e teste. A seção 2 é **evidência medida neste
> repositório** — ela existe para impedir que se invente nome de tipo, nome de arquivo ou
> campo de API. Referência de produto: `insiderstore.com.br` (cards com cor, preço
> "De/Por", nota em estrelas; página com abas de tecido/cuidados e bloco de avaliações).
> O que se copia da referência é a **informação exposta**, não o HTML dela.

---

## 12.1 Objetivo

Tornar a exposição de produtos e a rota `/products/[handle]` completas o suficiente para
vender, e **mover todo o conteúdo de produto para o cadastro do lojista**:

1. **Card** (vitrine, trilho de lançamentos, catálogo, relacionados): cores disponíveis,
   preço com desconto (**De/Por** + `-x%`) e nota em estrelas.
2. **Página de produto**: descrição, composição do tecido, cuidados, contraindicações e
   guia de medidas — alimentados pelo admin.
3. **Avaliações**: o cliente avalia a peça; a média e as estrelas alimentam o card e a
   página; o CRM modera.
4. **Curadoria**: o lojista escolhe quais peças aparecem em cada seção da vitrine.
5. **Sem seed de catálogo**: nenhuma peça, categoria ou nível de estoque vem do código.

**Fora de escopo:** lista de desejos, comparação de peças, multi-idioma, busca dedicada,
avaliação da loja, cupom por indicação (ver `09-backlog-implementacao.md`).

---

## 12.2 Fatos medidos neste repositório

### 12.2.1 O que já existe — **não reimplementar**

| O que | Onde | Estado |
| :--- | :--- | :--- |
| Preço com desconto calculado | `frontend/src/lib/util/get-product-price.ts` | `original_price`, `percentage_diff` e `price_type` já saem prontos |
| Preço riscado no card | `frontend/src/modules/products/components/product-preview/price.tsx` | "era 399, agora 249" já é o desenho (`.rv-price-was`) |
| Badge `-x%` e preço original | `frontend/src/modules/products/components/product-price/index.tsx:38-54` | Existe **na página** do produto, e não no card; `"From"`/`"Original:"` ainda em inglês (RV-003) |
| Chip de estado da peça no card | `frontend/src/lib/util/product-availability.ts` | Fonte única do "Pronta entrega"/"Últimas peças" |
| Contrato de conteúdo (seções) | `packages/contrato/src/contract.ts` | **É de seção de conteúdo, não de produto.** Não criar tipo de produto aqui |
| Tipos do storefront | `frontend/src/types/global.ts` | É onde mora `VariantPrice` — a casa dos tipos novos |
| Painel do CRM | `admin/src/admin/routes/{content,shipping}` | Só `routes/` e `i18n/` existem hoje; `admin/src/admin/i18n/index.ts` é `export default {}` |
| Chamada à Admin API no painel | `admin/src/admin/routes/content/page.tsx:360` | `fetch("/admin/…", { credentials: "include" })` |
| Ordenação de lista no painel | `admin/src/admin/routes/content/list-order.ts` | Setas (`move()`). **Não existe drag-and-drop** |

### 12.2.2 Onde cada dado de produto **pode** morar (medido)

- A Store API expõe, por padrão, `*variants`, `*options`, `*options.values`, `*images` e
  `*tags` do produto (`@medusajs/medusa/dist/api/store/products/query-config.js`). A lista
  de bloqueio da Store API é **só** de campo que pivota para dado privado
  (`…/api/store/utils/disallowed-fields.js`: `orders`, `carts`, `customer`,
  `payment_collection`…). **`metadata` não está nela.**
- O update de produto do admin aceita `material`, `origin_country`, `weight`, `length`,
  `height`, `width`, `metadata` **e** `variants: [{ id, metadata, material, … }]`
  (`@medusajs/medusa/dist/api/admin/products/validators.js` — `UpdateProductVariant` e
  `UpdateProduct`).
- **Mas:** `frontend/src/lib/data/products.ts` passa um `fields` explícito
  (`"*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,"`),
  e um `fields` explícito **substitui** os defaults. Logo, hex por variante
  (`+variants.metadata`) e a lista de opções de cor (`*options.values`) **não chegam hoje**
  e precisam ser pedidos de propósito.

### 12.2.3 O que **não** existe — proibido inventar

- `ProductCardData`, `ProductDetailData` e `ProductRating` **não existem** em lugar nenhum
  deste repositório. (`packages/contrato/src/contract.ts` é o contrato de **seção de
  conteúdo**.) Os tipos que a T3 criou são outros, e estão declarados:
  `ProductColor` e `ProductEnrichment` em `frontend/src/types/global.ts`, e
  `ProdutoComEnriquecimento`/`EstadoEnriquecimento` (entrada estrutural, sem SDK) em
  `frontend/src/lib/util/product-enrichment.ts`.
- O `locale` do dinheiro era `"en-US"` (`load-money`), e formatava `R$ 249.90`. Medido, e
  corrigido na T6.
- Não existe drag-and-drop no painel, e não existe `fetch` do browser para o catálogo
  curado: ele chega **no payload** (`readCategoryCatalog` → `api/admin/content/route.ts`).
- `admin/` **não é pacote**: não tem `package.json` e usa o `node_modules` do backend
  (`admin/jest.config.js` resolve por `../node_modules`). **Não se adiciona dependência
  nova no painel.**

---

## 12.3 Decisão de arquitetura

| Informação | Onde mora | Por quê |
| :--- | :--- | :--- |
| Preço com desconto | **Price List nativa do Medusa** | O storefront já lê `price_type === "sale"` (`get-product-price.ts`); a tela de Price Lists já existe no admin |
| Lista de cores | **Opção nativa "Cor"** (`product.options` / `variants[].options`) | É dado de framework: o lojista já cria a opção ao cadastrar as variantes |
| A cor em hex (a bolinha) | `variant.metadata.hex` | O Medusa não tem campo de cor; a hex é por variante (cor × tamanho) |
| Composição, país de origem, peso, dimensões | **Campos nativos** (`material`, `origin_country`, `weight`, `length/height/width`) | Existem e o admin já os edita; duplicar em metadata cria duas verdades |
| Cuidados, contraindicações, guia de medidas | `product.metadata.{care, contraindications, size_guide}` | O Medusa não tem campo para isso; texto livre, sem migração |
| Descrição | `product.description` (nativo) | Idem |
| Avaliações | **Módulo novo `review`** (tabela própria + rotas próprias) | Agregação e moderação não são metadata de produto |
| Curadoria da seção | Campo `list:products` que **já existe** no contrato, com a lista em ordem | Não criar terceira superfície de exposição |
| Como o lojista preenche | **Widget** em `admin/src/admin/widgets/`, zona `product.details.after` | O Vite do painel já varre `widgets/` (`backend/medusa-config.ts`) e a zona existe no `@medusajs/admin-shared`; evita duplicar o editor de produto |

---

## 12.4 Contrato de dados do enriquecimento

`product.metadata` (JSON, sem migração):

```jsonc
{
  "care": "Lavar à mão, não usar secadora, passar em temperatura baixa.",
  "contraindications": "Não indicado para pele com sensibilidade a fibra sintética.",
  "size_guide": "https://…/guia-de-medidas-alfaiataria.pdf"
}
```

`variant.metadata` (uma por variante):

```jsonc
{ "hex": "#B97872" }
```

Regras:

1. **Nenhuma chave nova é escrita sem estar nesta seção.** O normalizador do storefront lê
   **só** estas chaves; chave fora daqui é ignorada (não renderiza lixo na página).
2. `hex` só vale no formato `#RRGGBB`. Fora disso — e também quando a variante não tem hex — a
   amostra mostra a **inicial** do nome do valor da opção, e o nome inteiro fica no `sr-only`
   (leitor de tela) e no `title` (ponteiro). É degradação desenhada, nunca sumiço nem bolinha
   preta: sumir diria à cliente que a peça tem menos cores do que tem.
3. **A lista de cores vem da opção nativa**; o hex é enriquecimento. Variante sem hex
   continua aparecendo — pela inicial do nome.
4. Todo texto é pt-BR e é escrito pelo lojista. Nenhum valor padrão é inventado no
   componente.

---

## 12.5 Tarefas

> **Status (2026-10-08).** **Feitas, com os gates verdes** (`make check`, `make types`,
> `make test`, e a T1 verificada em banco limpo): **T1, T2, T3, T4, T5 e T6**. Cada seção diz
> o que foi entregue, com os nomes reais dos arquivos.
>
> **Pendentes: T7 a T10.** A T7 depende das decisões **1, 2 e 4** da seção 12.8 (avaliação
> verificada?, sem login?, preço zero — este último já resolvido "zero é preço" na T6) e a
> **T9** da decisão **3**. A T8 depende da T7 (sem fonte de nota não há estrela).

### T0 — Medir (antes de escrever qualquer linha)

Medir e **colar no PR**:

1. `curl` na Store API com o `fields` de `products.ts` mais `+variants.metadata` e
   `*options.values`, e conferir se `variants[].metadata.hex` e `options` voltam de fato.
   **Aceite:** a resposta colada. Se `+variants.metadata` não voltar, a T5 muda de desenho
   e para.
2. `GET /admin/products/:id?fields=…` com o painel aberto: confirmar que a tela de produto
   renderiza a zona `product.details.after` neste build (widget registrado sem erro no log).
3. Confirmar **na interface** do admin a presença de **Price Lists** no menu lateral.
4. `make up` e `make seed` numa base limpa, para ter a linha de base **antes** da T1.

### T1 — Tirar o catálogo do seed

**Objetivo:** nenhuma peça, categoria ou nível de estoque vem do código.

- `backend/src/scripts/seed.ts`: remover o passo **8** (categorias, l. 512), o passo **9**
  (produtos, l. 553) e o passo **10** (estoque, l. 835) e o que ficar sem uso (imports de
  `createProductsWorkflow`, `createProductCategoriesWorkflow`,
  `createInventoryLevelsWorkflow`, `CreateInventoryLevelInput`, `ProductStatus` e os blocos
  de dados das peças).
- **Manter os passos 1–7.** Eles não são catálogo de demonstração: sem região/região fiscal
  a Store API não calcula preço nem frete, sem publishable key o storefront não abre, e sem
  centro de distribuição o lojista **não consegue lançar estoque**. O arquivo passa a ser o
  *bootstrap da loja*, e o nome do export + o comentário de topo passam a dizer isso.
- `Makefile` (linha do `help`): o texto "Popula catalogo, o conteudo (vitrine e tema) e o
  schema do CRM" fica falso → trocar pelo que o alvo passou a fazer.
- `README.md`: linha 156 (exemplo do quickstart) e 633 (receita de base nova) prometem peça
  depois do `make seed` → trocar pelo passo "primeiro produto pelo admin".

**Não mexer em** `seed-content.ts` (medido: `grep -c "product\|categor" → 0`) nem em
`seed-schema.ts`.

**Aceite:** base limpa + `make seed` → a loja abre, a vitrine mostra os estados vazios, e o
admin cria categoria, produto, preço e estoque sem erro. **Teste:** rodar `make seed`
**duas vezes** e conferir que não há nível de estoque duplicado nem erro.

### T2 — Widget "Informações da peça" no admin

**Objetivo:** o lojista preenche cor, cuidados, contraindicações e guia de medidas onde ele
já cadastra o produto.

- Novo diretório `admin/src/admin/widgets/`, com:
  - `product-enrichment.tsx` — a tela, e o `config`;
  - `enriquecimento-form.tsx` — a regra em função pura (mesclagem, hex, corpo do POST).
    **A extensão é `.tsx`, e não `.ts`, por medição:** dentro de `widgets/` o plugin do admin
    (`@medusajs/admin-vite-plugin`) só habilita o parser de TypeScript para `.tsx`
    (`getParserOptions` empilha `"jsx"` sempre e `"typescript"` só quando o nome termina em
    `.tsx`), e a pasta é varrida **sem filtro de nome** (`crawl(source/widgets)`) — os `.ts`
    auxiliares de `routes/content` sobrevivem por causa do filtro por `page`
    (`crawl(source/routes, "page")`), não pela extensão. Com `.ts`, o `] as const` da regra
    derruba o parse (`SyntaxError: Missing semicolon. (38:1)`), o `medusa build` sai **0** e
    imprime `Frontend build completed successfully` com os dois erros no log (medido). O
    `make build-admin` passou a reprovar o log que trouxer `An error occurred while`;
  - `__tests__/enriquecimento-form.unit.spec.ts` — o teste dela.
- `defineWidgetConfig({ zone: "product.details.after", id: "real-valor:informacoes-da-peca" })`.
  **O campo é `zone`** (medido em `@medusajs/admin-sdk`: `WidgetConfig = { zone, id? }`); `id`
  é opcional, e existe para a ordenação/visibilidade que o lojista escolher na página
  sobreviver a uma mudança do arquivo.
- **O widget recebe `{ data }`** — e do `data` só se usa o `id` (medido: `SingleColumnPage`
  renderiza cada widget com `widgetProps = { data }`, mas a página de produto pede
  `-variants` e o default da Admin API não traz `variants.metadata`). O widget **lê o produto
  por conta própria**, com `fields=id,title,metadata,*variants,+variants.metadata`.
- Gravação: `POST /admin/products/:id` com
  `{ metadata: { …mesclado }, variants: [{ id, metadata: { …mesclado, hex } }] }` — os dois
  aceitos pelo validador do admin, e a resposta vem em `{ product }`.
- **Mesclar, nunca sobrescrever:** o update **substitui** o objeto `metadata` inteiro (e o da
  variante). O corpo nasce do que veio do servidor; campo em branco **remove** a chave (não
  grava `""`, que desenharia seção vazia na loja). Hex fora de `#RRGGBB` **bloqueia** o
  salvar, com a mensagem na tela.
- Campos nativos (material, país de origem, peso, dimensões) são escritos nos **campos
  nativos** pelo formulário do próprio Medusa — o widget não os duplica.
- **Regras do painel:** sem espelho do contrato, sem `switch` incompleto, sem dependência
  nova, `fetch` relativo com `credentials: "include"`.

**Aceite:** criar uma peça pelo admin, preencher o widget, salvar, reabrir e ver o valor
persistido; a variante guarda o hex; limpar um campo remove a chave (conferir no bloco
"Metadata" do Medusa que as outras chaves continuam lá). **Teste:** a suíte do CRM
(`cd admin && ../node_modules/.bin/jest -c jest.config.js`). **Gate:** `make test` (que inclui
`scripts/check-panel-tests.mjs`), `make types` e `make build-admin`.

**Feito (T2) — a cor se escolhe, além de se digitar (2026-10-08):**

- Cada variante ganhou uma **paleta** (`<input type="color">`, nativo — sem dependência nova)
  **ao lado** do campo de texto do hex, e não no lugar dele. Os dois escrevem no mesmo
  `mudarHex`: a paleta não é um segundo cadastro de cor, é o jeito rápido de preencher o campo
  que já existia. O hex continua visível porque é ele que o contrato (12.4) grava e é ele que
  se apaga para tirar a chave.
- **Normalização na gravação** (`normalizarHex`): `#b97872` escolhido na paleta é gravado como
  `#B97872`. O `<input type="color">` devolve minúsculo por especificação; sem normalizar antes
  de comparar, um `#b97872` sobre um `#B97872` já gravado passaria por "mudou" e a peça levaria
  um `POST` a cada save sem ninguém ter escolhido nada.
- **O campo nativo não tem estado vazio**, e isso é declarado, não improvisado:
  `COR_PADRAO_DO_SELETOR` (`#000000`) é o que a paleta mostra numa variante sem hex. Quem
  grava é o `onChange` — abrir a paleta e fechar sem mexer não escreve nada.
- `aria-label` próprio na paleta: `<input type="color">` não aceita `<Label>` como os campos do
  Medusa, e sem ele o leitor de tela anunciaria dois campos sem nome na mesma linha.
- Texto inválido **passa intacto** por `normalizarHex` (não é apagado no meio da digitação):
  quem reprova o salvar continua sendo `hexesInvalidos`, com a mensagem na tela.
- Testes novos na suíte do CRM: paleta abre no hex gravado em minúsculo, abre no padrão quando
  não há hex, normalização para maiúsculo e os dois casos de corpo (`#b97872` não é mudança;
  `#aabbcc` é gravado `#AABBCC`).

### T3 — Normalizador e tipos no storefront

- `frontend/src/lib/util/product-enrichment.ts`: lê `metadata` e devolve objeto tipado, com
  `null` por campo. Nunca lança, nunca inventa valor.
- Tipos novos em `frontend/src/types/global.ts` (ao lado de `VariantPrice`) — **nunca** em
  `packages/contrato`, que é o contrato de seção de conteúdo.
- `frontend/src/lib/data/products.ts`: passar a pedir, de propósito, `+variants.metadata` e
  as opções de cor (medido: o `fields` explícito substitui os defaults, então hoje eles não
  chegam).

**Aceite:** peça sem nenhuma chave de metadata renderiza a página inteira, sem `"-"` solto e
sem `undefined`. **Teste:** `frontend/src/lib/util/__tests__/product-enrichment.unit.spec.ts`
(vitest; `make test` roda o storefront).

**Feito antes da T1** (era pré-requisito de ler o catálogo, não de escrevê-lo): `products.ts`
passa a pedir **de propósito** `+variants.metadata`, `*variants.options` e `*options.values` —
o `fields` explícito substituía os defaults, e nem o hex da variante nem a lista de cores
chegavam. Ficou na constante `CAMPOS_DO_CATALOGO`, com o porquê item por item — e ela mora em
`frontend/src/lib/data/product-fields.ts`, **não** dentro do `products.ts`.

**Por que a constante saiu do `products.ts` (medido no build, e o motivo importa):** o
`products.ts` abre com `"use server"`, e num arquivo com esse diretivo só pode sair do módulo
**função async** — uma `const` de string derruba o `next build` inteiro, na coleta de dados da
primeira página que importa o módulo (`Failed to collect page data for
/[countryCode]/collections/[handle]`, com `A "use server" file can only export async functions,
found string` no `cause`). O `tsc` do storefront passa (a regra não é de tipo nenhum) e nenhum
teste unitário pegava (nenhum deles carrega um módulo de action). Por isso a lista mora num
arquivo próprio e sem SDK, como o `supported-sections.ts`.

**Feito (T3):**
- `frontend/src/types/global.ts` — `ProductColor` e `ProductEnrichment`.
- `frontend/src/lib/util/product-enrichment.ts` — `enriquecimentoDoProduto`, `coresDoProduto`,
  `bolinhasDoCard`, `textoDoMetadata`, `hexDoMetadata`, `normalizarTitulo` + o tipo estrutural
  `ProdutoComEnriquecimento` (sem SDK, para o teste poder montar um objeto de quinze linhas).
- `frontend/src/lib/data/product-fields.ts` — `CAMPOS_DO_CATALOGO` (o dono da lista).
- `frontend/src/lib/util/product-enrichment.spec.ts` — 15 testes, com **três conferências de
  fiação**, todas de fonte: (a) a lista ainda tem `+variants.metadata` e as opções — o defeito
  silencioso da tarefa (sem erro, só card sem cor); (b) o `listProducts` ainda **usa** a
  constante (`fields: CAMPOS_DO_CATALOGO`), e não um `fields` recriado na consulta; (c) a
  **guarda do `"use server"`**: lê o AST de cada arquivo de `src/lib/data` que abre com o
  diretivo e reprova export que não seja função async — é o defeito que o `next build` achou
  depois de 119s, e o teste o encontra aqui em 149ms.

### T4 — Página de produto: descrição, tecido, cuidados, contraindicações

- `frontend/src/modules/products/components/product-tabs/index.tsx`: as abas atuais leem
  `product.material`, `origin_country`, `type`, `weight` e dimensões, escrevem `"-"` quando
  vazio e são rotuladas em inglês ("Product Information", "Shipping & Returns") com conteúdo
  em pt-BR. Reorganizar em: **Descrição · Composição e tecido · Cuidados · Guia de medidas ·
  Contraindicações**, tudo em pt-BR.
- Contraindicações é **aviso**, não parágrafo comum: tratamento visual distinto e sempre
  visível quando existir.
- Descrição longa: `product.description` (nativo), sem metadata.

**Aceite:** peça preenchida pelo admin mostra as seções; peça sem `contraindications`
**não** mostra seção vazia; conferir a ordem no mobile. **Teste:** unidade do mapeamento
"metadata → seções" (função pura) + conferência visual em `/br/products/<handle>`.

**Feito (T4):**
- `frontend/src/lib/util/product-sections.ts` — `secoesDaPeca`, `fichaDaPeca` e `urlDoGuia`,
  com `kind` explícito (`texto` | `ficha` | `link` | `aviso`) e ordem fixa: descrição, ficha,
  cuidados, guia, aviso.
- `frontend/src/lib/util/product-sections.spec.ts` — 9 testes: o travessão que não existe, o
  guia que não é endereço (vira texto, não link quebrado), a descrição em branco e as três
  medidas que só valem juntas.
- `product-tabs/index.tsx` reescrito: consome a função pura, tem um ramo por `kind` (e o
  `default` com `never` faz um `kind` novo **reprovar o `tsc`** em vez de virar seção em
  branco), e o texto de entrega/trocas passou de inglês para **pt-BR**.
- **Corrigido de passagem:** a ficha não escreve mais `"-"` em campo vazio. Peça sem peso e sem
  dimensões não desenha "Peso -": a seção não existe.

### T5 — Cores no card

- Fonte da lista: opção nativa da variante (deduplicar por valor); hex do
  `variants[].metadata.hex`; sem hex, a cor aparece pelo nome.
- Novo componente `frontend/src/modules/products/components/product-preview/color-swatches.tsx`.
- **Restrição técnica medida:** a raiz do card é um `LocalizedClientLink`
  (`product-preview/index.tsx`). Bolinha clicável seria `<a>` dentro de `<a>` — inválido. As
  bolinhas são **`<span>` dentro do link do card**: o card inteiro leva à página, e lá a cor
  é escolhida. Nada de `onClick` para trocar a imagem do card.
- Limite visual (ex.: 5 + "+3") e acessibilidade: bolinha clara precisa de contorno visível.
  A aparência é decidida em `frontend/src/styles/brand.css`, não no componente.

**Aceite:** card com 3 cores mostra 3 bolinhas; card sem cor cadastrada não mostra espaço
vazio; leitor de tela anuncia o nome da cor. **Teste:** unidade da função "produto → cores
distintas" (vitest).

**Feito (T5):**
- `product-preview/color-swatches.tsx` — a lista de `<span>`, **sem clique**: a raiz do card é
  um `<LocalizedClientLink>`, e `<a>` dentro de `<a>` é HTML inválido (o navegador desfaz o de
  dentro e o clique passa a ter dois destinos). A escolha da cor é da página da peça, onde há
  estoque, preço e imagem por variante.
- A cor **sem hex** aparece com a **inicial do nome** — sumir diria à cliente que a peça tem
  menos cores do que tem. O nome inteiro vai no `sr-only` (leitor de tela) e no `title`
  (ponteiro), e o rótulo da `<ul>` lista **todas** as cores, para o `+n` não esconder
  informação de quem não vê a tela.
- O corte (`5` + `+3`) é `bolinhasDoCard`, no util e com teste: o número do `+n` sai da **mesma
  conta** que o corte.
- Ordem no card: nome → cores → preço e estado → convite.

**Feito (T5b) — a cor no seletor da página da peça (2026-10-08):**

O pedido que fechou isto foi direto: *"na parte da cor quero escolher a cor ou adicionar o
hexadecimal, e na loja quero que mostre a cor e não o nome da cor"*. Medido antes de mexer:

- **Não era defeito de fiação. Era dado faltando.** `curl` na Store API com o catálogo real
  mostrou **nenhuma** variante com `metadata` — sem hex, o card cai para a inicial do nome e a
  página desenhava os botões com o nome por extenso ("Preto Clássico", "Floral Off-White"). O
  card já estava certo; faltava o que preencher, e é isso que a paleta da T2 resolve.
- **A fiação da T5 está certa, e foi medida com hex no banco:** as duas listas de `fields`
  devolvem `options`, `variants[].options` e `variants[].metadata.hex` — a de
  `CAMPOS_DO_CATALOGO` e também a reduzida que a home usa
  (`*variants.calculated_price,+variants.images,+metadata,+tags`, em `featured-products` e
  `launches-rail`, que **passa por cima** do `fields` do `listProducts` por causa da ordem do
  spread). Consequência: `*variants.calculated_price` já traz o `metadata` da variante, então
  aquele `fields` próprio não quebra a bolinha — nenhuma chamada precisou mudar.
- **O seletor da página deixou de escrever o nome.** `option-select.tsx` desenha uma **amostra**
  por cor quando a opção é a de cor, e o nome do valor passa a existir só no `sr-only` (leitor
  de tela) e no `title` (ponteiro) — a mesma degradação do card (sem hex, a inicial do nome).
  Fora da opção de cor nada mudou: "Tamanho" continua botão de texto.
- **A decisão de qual opção é a cor é uma só** (`ehTituloDeCor`, no util, com teste): é a mesma
  que `coresDoProduto` usa para o card, então card e página não conseguem discordar sobre a
  mesma peça. As cores chegam ao seletor por `cores={coresDoProduto(product)}`, nas **duas**
  telas que o renderizam (`product-actions/index.tsx` e `mobile-actions.tsx`).
- **pt-BR de passagem:** o rótulo era `Select {title}` (inglês do template) e virou o título da
  opção ("Cor", "Tamanho"); no modal do celular, `Select Options` virou "Escolher opções".
- **Amostra clicável na página, `span` no card:** no card um botão seria `<a>` dentro de `<a>`;
  na página da peça o botão é obrigatório — é ali que a escolha troca estoque, preço e imagem.
- Guardas novas no `product-enrichment.spec.ts` (leitura de fonte, porque o componente é `.tsx`
  de cliente e o vitest do pacote roda sem DOM): a decisão por `ehTituloDeCor(title)`, o rótulo
  visível vindo de `{title}` com o nome do valor em `sr-only`, e a chegada de `cores={cores}` nas
  duas telas. **Negativa controlada medida:** trocar `ehTituloDeCor(title)` por `false` e apagar
  `cores={cores}` reprova os dois testes; restaurando, volta verde.

### T6 — Desconto: Price List, badge no card e pt-BR

A maior parte **já está feita** (`get-product-price.ts`, `product-preview/price.tsx`,
`product-price/index.tsx`). O que falta é fechado aqui:

1. Desconto é criado pelo lojista como **Price List** no admin (ver T0.3). Nada no código
   cria preço promocional.
2. **Badge `-x%` no card.** Hoje o percentual só existe na página
   (`product-price/index.tsx:53`). Levar ao card, na linha do preço, sem poluir — e
   **sem `-0%`** (`percentage_diff` é `"0"` quando não houve queda).
3. **pt-BR (fecha o RV-003).** O defeito real **não** era o separador do `get-percentage-diff`
   (medido: `toFixed()` sem argumento devolve inteiro, `"38"`). Era
   **`convertToLocale` com `locale = "en-US"` por padrão** (`lib/util/money.ts`), que formatava
   `R$ 249.90` em **todo** lugar que mostra dinheiro — card, página, carrinho, totais, pedido.
   O padrão passa a `pt-BR`. Os rótulos `"From"` / `"Original:"` da página viram
   `"A partir de"` / `"De"`.
4. **Preço zero é preço.** `getPricesForVariant` trata `calculated_amount === 0` como ausência
   hoje: a vitrine mostra a peça **sem preço** e o checkout a fecha por R$ 0,00 — duas telas
   discordando do mesmo dado. A ausência passa a ser o **bloco** `calculated_price` não existir.
5. **`-NaN%`:** `getPercentageDiff` ganha guarda para `original` ausente/zero (sem ela, a conta
   com `original_amount` nulo dá `NaN` e ele vai para a tela).

**Aceite:** com Price List ativa, card e página mostram De/Por e `-x%` em pt-BR; sem Price
List ativa, mostram apenas o preço, sem resquício de "Por" vazio. **Teste:**
`frontend/src/lib/util/get-product-price.spec.ts` (sale, não-sale, zero, sem variante,
variante escolhida, e a formatação `249,90`).

### T7 — Avaliações: módulo `review` + moderação no CRM

Módulo novo, na convenção do módulo `content` (`backend/src/modules/review/`, com `models/`,
`service.ts`, migração, `api/store/*`, `api/admin/*`).

- **Uma só fonte de verdade.** Ou a relação com o produto é a **coluna** `product_id`, ou é
  um `defineLink` — os dois juntos é o defeito que reprova o desenho.
- **`status` existe na primeira migração** (`pending | approved | rejected`) e toda escrita
  nasce `pending`. Nada de coluna que aparece numa etapa seguinte.
- **Nada de agregado escrito em `product.metadata`.** Se houver cache de média, ele é
  derivado, tem tabela própria, é mantido por workflow — e o comentário diz por quê.
- **Rotas:**
  - `POST /store/reviews` — cliente autenticado (`authenticate("customer")`), nota de 1 a 5 +
    título + corpo, com validação de faixa e de tamanho.
  - `GET /store/products/:id/reviews` — paginado, só aprovadas.
  - `GET /store/reviews/summary?product_ids=a,b,c` — **obrigatória**: o card lista 12 peças
    por trilho; um resumo por peça seria N+1. Com limite de ids por chamada.
- **Moderação** é rota própria no CRM (`admin/src/admin/routes/reviews/page.tsx`, aprovar e
  rejeitar), **não** um `FieldKind` no contrato de conteúdo: moderação de conteúdo e campo de
  seção são camadas diferentes.
- Aprovar/rejeitar precisa **invalidar o cache do catálogo** (a mesma tag dos trilhos), senão
  a estrela só muda no próximo `revalidate`.

**Aceite:** cliente avalia → entra como pendente no CRM → aprovada → aparece na página e move
a média do card. **Teste:** `backend/src/modules/review/__tests__/service.unit.spec.ts` (a
convenção é `*.unit.spec.ts`; `make test` roda com `--runInBand`).
**Mutação:** a migração só roda com `make migrate` — passo de execução, nunca automático.

### T8 — Nota e estrelas no card e no detalhe

- Um componente só (`frontend/src/modules/products/components/product-rating/`), usado no
  card e na página, para as duas telas não discordarem de média (mesmo princípio do
  `product-availability`).
- O card é componente de servidor: o resumo entra **junto com a lista** de produtos (uma
  chamada em lote para o trilho), não em `fetch` por card no browser.
- **Sem avaliação não é nota zero:** sem nenhuma avaliação aprovada não se renderiza estrela
  vazia nem "0,0" — renderiza "Seja a primeira a avaliar" (ou nada).
- Média com uma casa decimal e vírgula decimal (`4,7`), e a contagem entre parênteses.

**Aceite:** peça com 3 avaliações mostra média e contagem; peça sem avaliação mostra o
convite; a nota do card e a da página são idênticas para a mesma peça.

### T9 — Curadoria da seção de exposição

- Reusar o campo `list:products` **que já existe** no contrato de conteúdo, com seleção por
  busca **no payload já carregado** (`readCategoryCatalog` → `filters.ts`): nada de `fetch`
  novo do browser para o admin.
- Ordenar com as setas de `list-order.ts` (não existe drag-and-drop no painel, e não se
  introduz biblioteca: `admin/` não tem `package.json`).
- **A ordem é responsabilidade do storefront:** a Store API não honra a ordem de
  `productIds`. A lista é guardada em ordem e o frontend **reordena depois do fetch** pelo
  índice da lista curada. Comentário obrigatório no ponto de reordenação.
- Peça da lista que foi despublicada ou apagada é **pulada em silêncio**, sem card quebrado.

**Aceite:** trocar a ordem no painel muda a ordem na vitrine; curadoria vazia mostra estado
próprio, não um trilho com altura zero nem layout deslocado. **Teste:** unidade de "lista
curada + produtos → ordem final" (vitest).

### T10 — Estados vazios, SEO, gates e docs

- Com o seed removido, **curadoria vazia passa a ser o estado inicial** — todos os trilhos
  precisam de estado vazio desenhado.
- `generateMetadata` da rota de produto: título, descrição e imagem vindo da peça; peça sem
  `description` não pode gerar description vazia.
- Documentar as chaves da seção 12.4 na doc do módulo/README do CRM (onde o lojista for
  procurar).
- Atualizar a tabela de pendências do `09-backlog-implementacao.md` **e** a contagem da seção
  9.10 (a tabela soma itens: item novo muda duas tabelas, não uma).

**Gates finais:** `make check` (paridade do contrato + fronteiras) · `make types` (inclui
`admin/tsconfig.json`) · `make test` (backend + CRM + `check-panel-tests` + storefront) ·
`make build-admin` · `make gen` se o contrato mudar (commit do diff gerado) · `make revalidate`
se só o conteúdo mudou.

---

## 12.6 Proibido (anti-padrões medidos neste repositório)

1. **Não** declarar campos/fórmulas de produto dentro do painel: `admin/src` é varrido inteiro
   pelos testes de fiação do painel, e um espelho da tabela do contrato reprova a suíte.
2. **Não** guardar a mesma verdade em dois lugares (coluna **e** link; metadata **e** campo
   nativo; agregado **e** cálculo).
3. **Não** criar tipo de produto em `packages/contrato` — é contrato de seção de conteúdo.
4. **Não** usar nome de tipo de script antigo: `ProductCardData`, `ProductDetailData`,
   `ProductRating` e `ProductColor` não existem.
5. **Não** criar tipo estrutural copiado num arquivo que não importa o nome — o `tsc` compila
   verde e é exatamente a cópia que se proíbe.
6. **Não** adicionar dependência no painel.
7. **Não** fazer o storefront depender da ordem de `productIds` da Store API.
8. **Não** criar terceira superfície de exposição: usar `list:products`.
9. **Não** deixar valor padrão inventado no componente (preço, texto, cor) para "não ficar
   vazio".
10. **Não** rodar migração/seed por conta própria: são passos de execução.

---

## 12.7 Definition of Done

- [ ] `make seed` numa base limpa cria **zero** produtos, categorias e níveis de estoque.
- [ ] Uma peça cadastrada **inteiramente pelo admin** (produto, variante, cor, preço, Price
      List promocional, metadata) aparece na vitrine com cores, De/Por e `-x%`.
- [ ] A página da mesma peça mostra descrição, tecido, cuidados, guia de medidas e
      contraindicações.
- [ ] Avaliação do cliente passa por moderação no CRM e move a nota do card e da página.
- [ ] Curadoria pelo painel muda a ordem na vitrine; trilho vazio tem estado próprio.
- [ ] `make check`, `make types`, `make test` e `make build-admin` verdes.
- [ ] O build do storefront verde — o **mesmo comando da CI** (`cd frontend && yarn build`), e
      **sem `NODE_ENV` no ambiente**. Medido: com `NODE_ENV=development` (o que o shell deste
      ambiente tem) o Next avisa que o valor não é padrão e o prerender de `/404` aborta o build
      com `<Html> should not be imported outside of pages/_document`; a mesma árvore com
      `env -u NODE_ENV` fecha verde. `make build-admin` **não** substitui este gate, e vice-versa:
      são dois bundles diferentes.
- [ ] `README.md`, a ajuda do `Makefile` e a tabela do `09-backlog` atualizados.

---

## 12.8 Decisões humanas pendentes

1. **Avaliação é de compra verificada ou aberta?** (exigir `order_id` é mais confiável e mais
   restritivo.)
2. **Avaliação sem login?** Se sim, precisa de limite por IP, senão vira spam.
3. **Peça curada que foi despublicada:** sai da vitrine (recomendado) ou bloqueia a publicação
   da seção?
4. **Preço zero:** renderiza ou é ausência?
5. **Cuidados e contraindicações:** texto livre por peça, ou lista de opções padronizadas
   (permite filtro e reprocessamento depois)?

