/**
 * O contrato de pagamento, como pacote.
 * -------------------------------------------------------------------------
 * **Por que um arquivo só para isto.** O registro de meios de pagamento foi,
 * até aqui, um `switch` por tipo dentro do checkout: `isStripeLike(id)` levava
 * a um botão de cartão, `isManual(id)` a outro, e o resto caía em "selecione
 * uma forma". Cada provedor novo acrescentava um `if` — e o `if` seguinte nasce
 * errado, porque nada impede alguém de perguntar "este meio precisa de cartão
 * na minha página?" em vez de perguntar ao meio responsável.
 *
 * Aqui mora o **vocabulário**: como um meio se completa, o que ele sabe fazer,
 * e qual é o formato único que o resto do sistema entende. A interface que o
 * storefront implementa (`PaymentAdapter`, com `ReactNode` e `render`) vive em
 * `frontend/src/lib/payments/types.ts` — este arquivo é importado pelo backend
 * também, e não pode saber de React.
 *
 * A divisão é a mesma do `./schema`: o que os três runtimes compartilham fica
 * aqui; o que é de uma ponta só, lá.
 */

/**
 * Como um meio de pagamento se completa.
 *
 * Esta é a propriedade que decide **Checkout Pro** (redirecionamento) e
 * **Checkout API** (formulário na nossa página) — as duas do Mercado Pago, e
 * também a forma de qualquer outro provedor. Trocar de modalidade é mudar um
 * valor aqui, não reescrever o fluxo.
 */
export type FulfillmentMode =
  /** Redireciona para o provedor, que cuida do formulário. Checkout Pro. */
  | "redirect"
  /** O provedor monta o formulário na nossa página. Checkout API. */
  | "inline"
  /** Botão ou QR direto, sem checkout intermediário. Pix sem redirect. */
  | "external"

/** O estado de um pagamento, já normalizado. */
export type PaymentStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refunded"

/**
 * O formato **único** que o resto do sistema entende de um pagamento.
 *
 * Um adapter novo não inventa semântica nova: ele traduz a resposta do seu
 * provedor para este tipo. É o que permite trocar de provedor sem que o
 * checkout, o pedido e a vitrine saibam o nome de nenhum deles.
 */
export type PaymentResult = {
  status: PaymentStatus
  /** O `provider_id` que o Medusa devolve — o mesmo que o registry resolve. */
  providerId: string
  /** A referência do pagamento no provedor. Persiste em `order.metadata`. */
  reference: string
  /**
   * A resposta crua, só para diagnóstico.
   *
   * **Nunca** para decisão: o resto do sistema lê `status` e `reference`.
   * Guardar o bruto é o que permite responder "o que o provedor mandou?" sem
   * uma segunda chamada.
   */
  raw?: unknown
}

/** O que um meio de pagamento sabe fazer. O que não for `true` não aparece. */
export type PaymentCapabilities = {
  pix: boolean
  cards: boolean
  boleto: boolean
  /** Parcela sem juros. `false` não é "não parcela" — é "não parcelado". */
  interestFree: boolean
}

/** O parcelamento de um valor, já consultado no provedor. */
export type InstallmentInfo = {
  /** Quantas parcelas o provedor aceita para este valor e esta bandeira. */
  count: number
  /** O valor de cada parcela, em centavos. */
  amount: number
  /** `true` só quando o provedor confirmar que é sem juros. */
  interestFree: boolean
  /** A taxa aplicada, quando houver. */
  interestRate?: number
}

/**
 * O que `initiate` devolve.
 *
 * `redirectTo` só existe quando o `FulfillmentMode` é `"redirect"` — é a URL
 * de destino que o provedor devolveu. O storefront redireciona para lá.
 */
export type InitiateResult = {
  redirectTo?: string
  /** Dados públicos que a página pode mostrar (QR Pix, copia-e-cola). */
  publicData?: Record<string, unknown>
  reference: string
}

/**
 * O identificador do provedor manual do Medusa (`pp_system_default`).
 *
 * Ele não processa dinheiro: serve para percorrer o checkout em teste. Vive
 * aqui porque o registry precisa reconhecê-lo, e porque ele é o único meio que
 * **sempre** funciona — é o que mantém a loja atravessando um ambiente sem
 * credencial de nenhum provedor.
 */
export const MANUAL_PROVIDER_ID = "pp_system_default"

/**
 * Os `provider_id` dos provedores conhecidos do Medusa.
 *
 * O prefixo é o que o Medusa usa para nomear um provider
 * (`pp_<modulo>_<id>`). Ele é lido por `startsWith`, que é o que o próprio
 * Medusa faz — mas a lista é explícita de propósito: um `startsWith("pp_")`
 * solto aceitaria qualquer provedor registrado, inclusive um que ninguém do
 * storefront conhece.
 */
export const STRIPE_PROVIDER_PREFIX = "pp_stripe_"
export const MEDUSA_PAYMENTS_PROVIDER_PREFIX = "pp_medusa-"
