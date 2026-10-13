// O vocabulário do catálogo que a `lib` compartilha com a UI — a narrativa do
// `SortOptions` (a inversão que a R-A proíbe) está em doc 15 §15.6.

/** As três ordens que a loja sabe aplicar (`sortProducts`). */
export type SortOptions = "price_asc" | "price_desc" | "created_at"

/** A ordem de quem não escolheu nenhuma: uma só, para as cinco telas. */
export const DEFAULT_SORT: SortOptions = "created_at"

export type VariantPrice = {
  calculated_price_number: number
  calculated_price: string
  original_price_number: number
  original_price: string
  currency_code: string
  price_type: string
  percentage_diff: string
}

/** Uma cor da peça: `hex` é `#RRGGBB` ou `null` — nunca string vazia. */
export type ProductColor = {
  name: string
  hex: string | null
}

/** O que o painel grava na peça e a loja lê (doc 12): ausência é `null`. */
export type ProductEnrichment = {
  care: string | null
  contraindications: string | null
  sizeGuide: string | null
  colors: ProductColor[]
}
