import { StorePrice } from "@medusajs/types"

export type FeaturedProduct = {
  id: string
  title: string
  handle: string
  thumbnail?: string
}

export type VariantPrice = {
  calculated_price_number: number
  calculated_price: string
  original_price_number: number
  original_price: string
  currency_code: string
  price_type: string
  percentage_diff: string
}

/**
 * Uma cor da peça, como o card e a página a mostram.
 *
 * `name` é o valor da opção que o lojista cadastrou (é ele que aparece quando não
 * há hex). `hex` é `#RRGGBB` ou `null` — nunca string vazia e nunca um valor
 * inválido: quem lê daqui escolhe entre a amostra e o nome, e não precisa saber
 * que o hex é opcional nem validar formato na tela.
 */
export type ProductColor = {
  name: string
  hex: string | null
}

/**
 * O que o painel grava na peça e a loja lê (chaves da seção 12.4 de
 * `docs/real-valor/12-script-enriquecimento-catalogo.md`).
 *
 * Tudo é `string | null` porque **não existe valor padrão inventado**: campo que
 * o lojista não preencheu é `null`, e a tela decide não desenhar a seção. Um `""`
 * aqui viraria seção vazia na página da peça.
 *
 * `colors` sai da **opção** da peça (é dado do Medusa), e não do `metadata`; o
 * hex é o enriquecimento dele.
 */
export type ProductEnrichment = {
  care: string | null
  contraindications: string | null
  sizeGuide: string | null
  colors: ProductColor[]
}

export type StoreFreeShippingPrice = StorePrice & {
  target_reached: boolean
  target_remaining: number
  remaining_percentage: number
}
