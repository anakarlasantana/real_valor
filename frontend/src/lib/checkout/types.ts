import { StorePrice } from "@medusajs/types"

/** O preço do frete grátis: o alvo, o que falta e quanto disso já foi. */
export type StoreFreeShippingPrice = StorePrice & {
  target_reached: boolean
  target_remaining: number
  remaining_percentage: number
}
