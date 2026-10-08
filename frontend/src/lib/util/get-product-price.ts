import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-percentage-diff"
import { convertToLocale } from "./money"

/**
 * O preço calculado de uma variante, no formato que a loja desenha.
 *
 * **Preço zero é preço.** A guarda era `!variant?.calculated_price?.calculated_amount`,
 * que trata `0` como ausência — e a loja tem peça de brinde/valor zero, que é
 * vendida de verdade pelo carrinho. Com a guarda antiga, a vitrine mostrava a
 * peça **sem preço** enquanto o checkout a fechava por R$ 0,00: duas telas
 * discordando do mesmo dado, e a cliente descobrindo no fim.
 *
 * O que é ausência é o **bloco** de preço calculado não existir (variante sem
 * preço na região) — e é só isso que devolve `null`, para a tela escolher entre o
 * esqueleto e o convite.
 */
export const getPricesForVariant = (variant: any) => {
  if (!variant?.calculated_price) {
    return null
  }

  return {
    calculated_price_number: variant.calculated_price.calculated_amount,
    calculated_price: convertToLocale({
      amount: variant.calculated_price.calculated_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    original_price_number: variant.calculated_price.original_amount,
    original_price: convertToLocale({
      amount: variant.calculated_price.original_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    currency_code: variant.calculated_price.currency_code,
    price_type: variant.calculated_price.calculated_price.price_list_type,
    percentage_diff: getPercentageDiff(
      variant.calculated_price.original_amount,
      variant.calculated_price.calculated_amount
    ),
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant: any = product.variants
      .filter((v: any) => !!v.calculated_price)
      .sort((a: any, b: any) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    return getPricesForVariant(cheapestVariant)
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant(variant)
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
