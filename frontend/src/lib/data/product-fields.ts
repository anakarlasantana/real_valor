/**
 * O que o catálogo pede à Store API — a lista de `fields` da listagem.
 * -------------------------------------------------------------------------
 * **Um `fields` explícito substitui os defaults da Store API.** Medido em
 * `api/store/products/query-config.js`: os defaults trazem `*options.values` e
 * `*variants.options`, e **não** trazem `metadata` nem `variants.metadata`. Ou
 * seja, campo que não estiver nesta linha **não chega** — e o defeito não aparece
 * como erro: aparece como card sem cor e página sem cuidados, calado.
 *
 * Cada peça daqui tem dono, e nenhuma entra "por via das dúvidas":
 *
 *   - `*variants.calculated_price` — o preço e o "De/Por" (`get-product-price`);
 *   - `+variants.inventory_quantity` — o chip de estoque (`product-availability`);
 *   - `*variants.images` — a troca de imagem na página;
 *   - `*variants.options` — a que cor cada variante pertence;
 *   - `+variants.metadata` — o hex da cor, por variante;
 *   - `+metadata` — cuidados, contraindicações e guia de medidas;
 *   - `*options` e `*options.values` — a lista de cores da peça;
 *   - `+tags` — o `tag_status` e as etiquetas do chip;
 *   - `*categories` — a categoria de cada peça, que é a faceta "Categoria" do
 *     catálogo (`lib/util/catalog-filters.ts`). Sem ela a faceta não existe: os
 *     defaults da Store API não trazem a lista, e o filtro por categoria ficaria
 *     com um valor só — o da página em que se está.
 *
 * UMA LISTA MENOR NA CHAMADA **SUBSTITUI** ESTA, E O DEFEITO É CALADO
 * -------------------------------------------------------------------------
 * `listProducts` monta a consulta com esta lista e **só depois** espalha os
 * `queryParams` do chamador: quem passa `fields` manda, e o que sai desta lista
 * deixa de chegar sem erro nenhum — o mesmo defeito silencioso descrito acima,
 * um nível acima. Já aconteceu com os trilhos da vitrine ("Lançamentos" e "Peças
 * em destaque"), que pediam uma lista curta e por isso liam a peça **sem
 * estoque** (o vestido com 50 unidades aparecia como *esgotado* na home e como
 * *pronta entrega* no catálogo), sem o hex da cor (as bolinhas saíam como letras)
 * e sem a categoria (o card ficava sem o eyebrow).
 *
 * A regra, então, é uma só: **quem lista peça não escreve `fields`**. Campo novo
 * que uma tela precise entra nesta lista, e a guarda que reprova um `fields`
 * recriado numa tela está em `product-enrichment.spec.ts`.
 *
 * POR QUE ISTO NÃO MORA NO `products.ts`, QUE É QUEM USA (medido)
 * -------------------------------------------------------------------------
 * O `products.ts` abre com `"use server"`, e num arquivo com esse diretivo só
 * pode sair do módulo **função async**. Esta lista é uma string: exportá-la de lá
 * derruba o `next build` INTEIRO, na coleta de dados da primeira página que
 * importa o módulo —
 *
 *     Failed to collect page data for /[countryCode]/collections/[handle]
 *     [cause]: Error: A "use server" file can only export async functions,
 *     found string
 *
 * — e nada antes disso acusa: o `tsc` do storefront passa (a regra não é de tipo
 * nenhum) e os testes unitários passam (nenhum deles carrega um módulo de
 * action). Quem acusa é a guarda em `product-enrichment.spec.ts`, que lê o AST
 * dos módulos de `src/lib/data` e roda em milissegundos; o `import` que a usa no
 * `products.ts` é a única fiação entre os dois arquivos, e ela também é
 * conferida lá.
 *
 * Arquivo próprio e sem SDK, como o `supported-sections.ts`: conferir a lista
 * não precisa do cliente da Medusa.
 */
export const CAMPOS_DO_CATALOGO =
  "*variants.calculated_price,+variants.inventory_quantity,*variants.images," +
  "*variants.options,+variants.metadata,+metadata,*options,*options.values,+tags," +
  "*categories"
