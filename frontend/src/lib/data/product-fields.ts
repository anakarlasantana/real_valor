/**
 * O que o catálogo pede à Store API — a lista de `fields` da listagem: **um
 * `fields` explícito substitui os defaults** (medido em `query-config.js`), e
 * campo fora desta lista **não chega** — o defeito é calado, não um erro.
 */

/*
 * Cada campo tem dono, e nenhum entra "por via das dúvidas": `calculated_price`
 * (preço/"De-Por", `get-product-price`); `inventory_quantity` (chip de estoque,
 * `product-availability`); `variants.images` (troca de imagem); `variants.options`
 * (a cor de cada variante); `variants.metadata` (hex da cor); `metadata` (cuidados,
 * contraindicações, medidas); `options`/`options.values` (cores da peça); `tags`
 * (etiquetas do chip); `categories` (a faceta "Categoria",
 * `lib/catalog/catalog-filters.ts` — sem ela restaria um valor só).
 * Quem passa `fields` manda: `listProducts` espalha os `queryParams` do chamador
 * **depois** desta lista, e o que sai dela deixa de chegar sem erro nenhum. Já
 * aconteceu com os trilhos da vitrine, que liam a peça **sem estoque** (o vestido
 * de 50 unidades aparecia *esgotado* na home e *pronta entrega* no catálogo) e
 * sem o hex da cor. A regra é uma só: **quem lista peça não escreve `fields`**;
 * campo novo entra nesta lista — a guarda está em `product-enrichment.unit.spec.ts`.
 * Não mora no `products.ts` porque ele abre com `"use server"`, e num arquivo com
 * esse diretivo só sai do módulo **função async**: exportar esta string derruba o
 * `next build` (`A "use server" file can only export async functions, found
 * string`); o `tsc` e os testes unitários passam, quem acusa é a guarda do AST.
 */
export const CAMPOS_DO_CATALOGO =
  "*variants.calculated_price,+variants.inventory_quantity,*variants.images," +
  "*variants.options,+variants.metadata,+metadata,*options,*options.values,+tags," +
  "*categories"
