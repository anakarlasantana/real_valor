/** O contrato de pagamento: como um meio se completa, o que ele sabe fazer
 * e o formato único que o resto entende. O `PaymentAdapter` (com React) fica
 * em `frontend/src/lib/payments/types.ts` — aqui nada pode saber de React. */

/** Como um meio se completa: `redirect` (Checkout Pro), `inline` (Checkout
 * API, na nossa página) ou `external` (Pix, botão ou QR direto). */
export type FulfillmentMode =
  | "redirect"
  | "inline"
  | "external"

export type PaymentStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refunded"

/** O formato único de um pagamento: o adapter traduz a resposta do provedor
 * para cá. `providerId` é o id do registry e `reference` persiste em
 * `order.metadata`; `raw` é só diagnóstico — **nunca** para decisão. */
export type PaymentResult = {
  status: PaymentStatus
  providerId: string
  reference: string
  raw?: unknown
}

/** O que um meio sabe fazer (`false` não aparece); `interestFree` false é
 * "não parcelado", não "não parcela". */
export type PaymentCapabilities = {
  pix: boolean
  cards: boolean
  boleto: boolean
  interestFree: boolean
}

export type InstallmentInfo = {
  /** Quantas parcelas, o valor de cada uma em centavos e se é sem juros. */
  count: number
  amount: number
  interestFree: boolean
  interestRate?: number
}

/** O que `initiate` devolve: `redirectTo` só existe no modo `"redirect"`;
 * `publicData` são os dados que a página mostra (QR Pix, copia-e-cola). */
export type InitiateResult = {
  redirectTo?: string
  publicData?: Record<string, unknown>
  reference: string
}

/** O provedor manual do Medusa (`pp_system_default`): não processa dinheiro,
 * só percorre o checkout em teste — o único que **sempre** funciona, sem credencial. */
export const MANUAL_PROVIDER_ID = "pp_system_default"

/** Os `provider_id` dos provedores do Medusa (`pp_<modulo>_<id>`): lista
 * explícita, porque um `startsWith("pp_")` solto aceitaria qualquer um. */
export const STRIPE_PROVIDER_PREFIX = "pp_stripe_"
export const MEDUSA_PAYMENTS_PROVIDER_PREFIX = "pp_medusa-"

/** O prefixo dos provedores do Mercado Pago — **não** é o id de um provedor:
 * o registry resolve por `startsWith`, e um adapter com este id casaria com os dois. */
export const MERCADOPAGO_PROVIDER_PREFIX = "pp_mercadopago_"

/** Os `provider_id` dos checkouts Pix e cartão (`.../payment/mercadopago/`). */
export const MERCADOPAGO_PIX_PROVIDER_ID = "pp_mercadopago_pix"

export const MERCADOPAGO_CARTAO_PROVIDER_ID = "pp_mercadopago_cartao"
