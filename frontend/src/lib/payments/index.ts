/**
 * A fachada do registry.
 * -------------------------------------------------------------------------
 * Este é o **único** arquivo que o checkout importa. Existe para que a
 * superfície pública seja uma função e não um `Map` — quando aparecer um
 * adapter novo, ninguém precisa saber que existe um `registry.ts` atrás.
 *
 * Também concentra a resposta ao `FulfillmentMode`, que é a pergunta que o
 * checkout faz: "como este meio se completa?". A pergunta que o código fazia
 * antes — "este meio precisa de cartão na minha página?" — era a mesma, com
 * o nome preso a um provedor.
 */
export { listPaymentAdapters, resolvePayment } from "./registry"
export type {
  FulfillmentMode,
  InitiateResult,
  InstallmentInfo,
  PaymentAdapter,
  PaymentCapabilities,
  PaymentRenderContext,
  PaymentResult,
  PaymentStatus,
} from "./types"

import { resolvePayment } from "./registry"
import type { FulfillmentMode } from "./types"

/**
 * Este meio precisa de formulário na NOSSA página?
 *
 * `inline` é o único que sim — é o cartão do Stripe hoje, e será o formulário
 * do Checkout API quando a modalidade mudar. `redirect` manda a cliente para o
 * provedor (Checkout Pro), e `external` não tem checkout nenhum (o meio
 * manual).
 *
 * **Trocar Checkout Pro por Checkout API é mudar um valor no adapter.** Esta
 * função não muda, e `modules/checkout/` não muda — é o critério de aceite
 * nº 7 do RV-002.
 */
export function needsInlineInput(providerId?: string | null): boolean {
  return resolvePayment(providerId).fulfillment === ("inline" as FulfillmentMode)
}