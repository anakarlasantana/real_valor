/**
 * A interface que o STOREFRONT implementa para um meio de pagamento.
 * -------------------------------------------------------------------------
 * O vocabulário (status, capabilities, `FulfillmentMode`, `PaymentResult`) vem
 * do pacote do contrato (`@rv/contrato/payment`), que o backend também
 * importa. Aqui só mora o que é **de uma ponta só** e precisa de React.
 *
 * A divisão não é preciosismo: `@rv/contrato` é importado pelo `backend/` e
 * pelo `admin/` também, e um `ReactNode` aqui quebraria os dois.
 */
import type {
  FulfillmentMode,
  InitiateResult,
  InstallmentInfo,
  PaymentCapabilities,
  PaymentResult,
} from "@rv/contrato/payment"
import type { StoreCart } from "@medusajs/types"
import type { ReactNode } from "react"

export type {
  FulfillmentMode,
  InitiateResult,
  InstallmentInfo,
  PaymentCapabilities,
  PaymentResult,
  PaymentStatus,
} from "@rv/contrato/payment"

/** O que um `render` recebe. Só o que é dado — nada de `setState`. */
export type PaymentRenderContext = {
  /** O valor total, em centavos. */
  amount: number
  /** O `cart_id`, para o backend reler o total. */
  cartId: string
}

/**
 * O que a UI de um meio `inline` reporta para o checkout.
 *
 * Existe porque o cartão do Stripe precisa dizer "está completo?" e "qual a
 * bandeira?" — e o checkout precisa disso para habilitar o botão. Um meio
 * `redirect` não reporta nada; um `inline` mais novo (o Checkout API) reporta o
 * mesmo formato.
 */
export type InlinePaymentStatus = {
  /** O formulário está completo e pode ser enviado. */
  complete?: boolean
  /** A bandeira do cartão, para o resumo ("Visa"). */
  brand?: string
  /** Uma mensagem de erro do próprio meio. */
  error?: string | null
}

export type InlinePaymentUIProps = {
  /** Se este meio é o selecionado — só o selecionado desenha o formulário. */
  selected: boolean
  /** O meio reporta por aqui; o checkout nunca pergunta ao meio diretamente. */
  onStatus: (status: InlinePaymentStatus) => void
}

/**
 * As props do botão de confirmar que o meio precisa.
 *
 * `cart` é o `StoreCart` do Medusa. Tipá-lo aqui, e não como `unknown`, é o que
 * deixa o botão do meio acessar `billing_address` e `payment_collection` sem
 * `any` — e o que faz o erro aparecer aqui se o Medusa mudar, e não lá dentro.
 */
export type ConfirmButtonProps = {
  /** O checkout ainda não tem tudo (endereço, frete, e-mail). */
  notReady: boolean
  cart: StoreCart
  "data-testid"?: string
}

export type PaymentAdapter = {
  /** O `provider_id` que o Medusa devolve. É a chave do registry. */
  id: string
  /** O nome exibido na lista de meios ("Pix", "Cartão de crédito"). */
  label: string
  /** O ícone do meio. */
  icon: ReactNode
  /** O que este meio sabe fazer. O que não for `true` não é exibido. */
  capabilities: PaymentCapabilities
  /** Como este meio se completa: `redirect`, `inline` ou `external`. */
  fulfillment: FulfillmentMode
  /**
   * Envolve a árvore do checkout num contexto que este meio exige.
   *
   * Existe porque o Stripe precisa de `<Elements>` (do `@stripe/react-stripe-js`)
   * para que `useStripe()` funcione nos componentes abaixo. Sem este member, o
   * `payment-wrapper` teria que saber do Stripe — que é exatamente o
   * acoplamento que o registry existe para eliminar.
   *
   * Recebe `clientSecret`, que vem da **sessão** (montada pelo servidor), não
   * do provedor: é dado de sessão, e por isso o wrapper o passa como prop em
   * vez de o registry carregá-lo. Um meio que não usa `clientSecret` (o
   * Checkout Pro do Mercado Pago, por exemplo) simplesmente o ignora.
   *
   * `undefined` na maioria dos meios: só o que exige contexto o declara.
   */
  Provider?: React.FC<{ clientSecret?: string; children: ReactNode }>
  /** Inicia o pagamento. Ausente quando não há nada a iniciar. */
  initiate?: (ctx: PaymentRenderContext) => Promise<InitiateResult>
  /**
   * A UI do meio, quando o `fulfillment` for `inline`.
   *
   * **Ausente no Checkout Pro** — o provedor cuida do formulário, e não há nada
   * a desenhar. É este member opcional que mantém a porta aberta para a
   * Checkout API: mesma interface, um método a mais.
   *
   * Não é uma função que devolve JSX, mas um **componente**: ele precisa de
   * `useState`/`useEffect`, e devolver JSX de dentro de um `.ts` obrigaria o
   * adapter a ser `.tsx` e a levar hooks para dentro de uma chamada. Como
   * componente, ele também é renderizado **dentro** do `Provider` acima, e por
   * isso enxerga o contexto (`useStripe`, no caso do cartão).
   */
  InlineUI?: React.ComponentType<InlinePaymentUIProps>
  /**
   * O botão de CONFIRMAR, para meios que precisam de uma confirmação própria.
   *
   * Ausente na maioria dos meios: `redirect` e `external` finalizam pelo botão
   * comum do checkout. Quem precisa de um é o `inline`, que tem de mandar os
   * dados do formulário ao provedor antes de finalizar o pedido — hoje é o
   * cartão do Stripe (`confirmCardPayment`).
   */
  ConfirmButton?: React.ComponentType<ConfirmButtonProps>
  /** O parcelamento de um valor, consultado no provedor. */
  describe?: (amount: number) => Promise<InstallmentInfo | null>
  /** Normaliza a resposta do webhook do provedor. */
  handleWebhook?: (payload: unknown) => Promise<PaymentResult>
}
