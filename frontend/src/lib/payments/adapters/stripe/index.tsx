"use client"

/**
 * O adapter do Stripe — **temporário**, sai no RV-048.
 * -------------------------------------------------------------------------
 * Ele existe porque o `switch` do checkout precisa sair agora, e apagar o Stripe
 * antes do Mercado Pago deixaria o checkout sem nenhum caminho de pagamento. A
 * migração é de comportamento, não de aparência: o que o Stripe fazia, este
 * adapter faz. Quando o MP entrar (RV-002), entra como mais um adapter — e o
 * checkout não muda.
 *
 * **O que este adapter tem de especial:** o Stripe exige um contexto
 * (`<Elements>` do `@stripe/react-stripe-js`) para que `useStripe()` funcione
 * nos componentes abaixo. É o único motivo de o `PaymentAdapter` ter o member
 * `Provider` — e é exatamente o tipo de detalhe que, se o `payment-wrapper`
 * soubesse dele, acoplaria o checkout de novo.
 *
 * `fulfillment: "inline"` porque o cartão é desenhado **na nossa página** (o
 * `CardElement` do `payment-container`). O Checkout Pro do Mercado Pago é
 * `redirect` — o valor oposto, e é por isso que os dois convivem no mesmo
 * registro.
 */
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js"
import { createContext, useContext } from "react"
import {
  MEDUSA_PAYMENTS_PROVIDER_PREFIX,
  STRIPE_PROVIDER_PREFIX,
} from "@rv/contrato/payment"

import type { PaymentAdapter } from "../../types"

import { StripeCardContainer } from "./card-container"
import { StripePaymentButton } from "./payment-button"

/**
 * A chave pública do Stripe.
 *
 * `NEXT_PUBLIC_STRIPE_KEY` foi **removida** do `.env.example` e do Compose
 * quando o Stripe saiu do escopo — então, em desenvolvimento, isto é
 * `undefined` e o `Provider` abaixo degrada para um wrapper inerte. É o
 * comportamento de antes: sem chave, `stripePromise` já era `null` e o
 * `payment-wrapper` caía no ramo não-Stripe. Este arquivo sai inteiro no
 * RV-048; até lá, existe para não haver uma janela sem pagamento.
 */
const stripeKey =
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY

const medusaAccountId = process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID

const stripePromise: Promise<Stripe | null> | null = stripeKey
  ? loadStripe(
      stripeKey,
      medusaAccountId ? { stripeAccount: medusaAccountId } : undefined
    )
  : null

/** `true` quando há contexto do Stripe disponível abaixo deste ponto. */
export const StripeContext = createContext(false)

export const useStripeContext = () => useContext(StripeContext)

/** O `useStripe`/`useElements` deste adapter, para o botão do cartão. */
export const useStripeElements = () => ({
  stripe: useStripe(),
  elements: useElements(),
})

/** `true` quando este adapter é quem responde por este id. */
export const isStripeId = (id: string) =>
  id.startsWith(STRIPE_PROVIDER_PREFIX) ||
  id.startsWith(MEDUSA_PAYMENTS_PROVIDER_PREFIX)

type StripeProviderProps = {
  /** O `client_secret` da sessão de pagamento — o que o `<Elements>` consome. */
  clientSecret?: string
  children: React.ReactNode
}

const StripeProvider: React.FC<StripeProviderProps> = ({
  clientSecret,
  children,
}) => {
  // O `<Elements>` recebe o `clientSecret` da sessão, como fazia o
  // `stripe-wrapper` antigo — é ele que amarra o `CardElement` ao
  // PaymentIntent. Sem ele (ou sem chave) os filhos renderizam, mas
  // `useStripe()` devolve `null` e o botão do cartão fica desabilitado.
  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret }
    : undefined

  if (!stripePromise || !options) {
    // Sem chave: os filhos renderizam, mas `useStripe()` devolve `null` e o
    // botão do cartão fica desabilitado. A loja continua navegável — que é o
    // comportamento do `payment-wrapper` antigo, sem o `throw`.
    return (
      <StripeContext.Provider value={false}>
        {children}
      </StripeContext.Provider>
    )
  }

  return (
    <StripeContext.Provider value={true}>
      <Elements options={options} stripe={stripePromise}>
        {children}
      </Elements>
    </StripeContext.Provider>
  )
}

export const stripeAdapter: PaymentAdapter = {
  id: STRIPE_PROVIDER_PREFIX,
  label: "Cartão de crédito",
  icon: null,
  capabilities: {
    pix: false,
    cards: true,
    boleto: false,
    interestFree: false,
  },
  fulfillment: "inline",
  Provider: StripeProvider,
  /**
   * A UI do cartão. É o que o checkout renderiza para um meio `inline` — e o
   * checkout **não sabe que este formulário é de cartão nem do Stripe**: ele
   * pegou este componente do registry.
   *
   * Funciona porque o `Provider` acima envolve a árvore inteira do checkout: o
   * `InlineUI` é desenhado dentro dele e enxerga o `useStripe()`.
   */
  InlineUI: StripeCardContainer,
  /**
   * O cartão precisa de confirmação própria: `confirmCardPayment` manda os
   * dados ao Stripe **antes** de o pedido ser finalizado. Um meio `redirect`
   * não tem isto — a cliente já autorizou fora, e o botão é só o comum.
   */
  ConfirmButton: StripePaymentButton,
}
