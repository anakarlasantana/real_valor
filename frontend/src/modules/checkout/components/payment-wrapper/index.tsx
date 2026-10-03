"use client"

/**
 * O contexto que o meio de pagamento escolhido exige.
 * -------------------------------------------------------------------------
 * **Este arquivo não conhece nenhum provedor.** Antes ele importava o Stripe
 * diretamente, montava `<Elements>` e decidia com `isStripeLike(...)` — e era
 * essa linha que prendia o checkout ao Stripe. Agora ele pergunta ao registry
 * qual adapter responde pela sessão e pergunta a **ele** qual é o `Provider`.
 *
 * A maioria dos meios não declara `Provider` (o Mercado Pago, por exemplo), e
 * então estes são só os filhos — que é o caso comum.
 */
import { resolvePayment } from "@lib/payments/registry"
import { HttpTypes } from "@medusajs/types"

type PaymentWrapperProps = {
  cart: HttpTypes.StoreCart
  children: React.ReactNode
}

const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ cart, children }) => {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const adapter = resolvePayment(paymentSession?.provider_id)

  // Meio sem contexto: devolve os filhos como estão. É o caminho do Mercado
  // Pago e do meio manual.
  if (!adapter.Provider) {
    return <div>{children}</div>
  }

  // O `clientSecret` vai por prop, e não de dentro do adapter: ele é dado da
  // SESSÃO (que o servidor montou), não do provedor. O `Provider` do adapter
  // recebe o que ele precisa saber; o registry não passa a carregar dado.
  const clientSecret = paymentSession?.data?.client_secret as
    | string
    | undefined

  return (
    <adapter.Provider clientSecret={clientSecret}>{children}</adapter.Provider>
  )
}

export default PaymentWrapper

