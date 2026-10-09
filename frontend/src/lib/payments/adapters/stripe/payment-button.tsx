"use client"

/**
 * O botão de pagamento por cartão do Stripe — **temporário**, sai no RV-048.
 * -------------------------------------------------------------------------
 * Ele saiu de `payment-button/index.tsx` para que aquele arquivo **não importe
 * `@stripe/react-stripe-js`** — que é o que a regra de fronteira do RV-014
 * exige. Com o botão aqui, `payment-button/index.tsx` só conhece o registry, e
 * a dependência do Stripe fica confinada a este arquivo e ao adapter.
 *
 * Continua sendo um arquivo nosso, e não algo do `render` do adapter, por um
 * motivo concreto: o `<CardElement>` é controlado pelo `Elements` que o
 * `Provider` do adapter monta, e este botão fala com esse contexto via
 * `useStripe()`/`useElements()`. Separar os dois exigiria que o `Elements`
 * envolvesse só parte da árvore, o que o React não faz bem.
 *
 * Quando o Mercado Pago entrar (RV-002), ele é `redirect` e **não** precisa de
 * nada disso. Este arquivo existe até o RV-048.
 */
import { placeOrder } from "@lib/data/cart"
import type { HttpTypes } from "@medusajs/types"
import { useStripeElements } from "./index"
import { useState } from "react"
import ErrorMessage from "@modules/checkout/components/error-message"

type StripePaymentButtonProps = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

export const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: StripePaymentButtonProps) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const { stripe, elements } = useStripeElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }: { error?: { message?: string; payment_intent?: { status: string } }; paymentIntent?: { status: string } }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          paymentIntent &&
          (paymentIntent.status === "requires_capture" ||
            paymentIntent.status === "succeeded")
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <button
        type="button"
        className="rv-btn rv-btn-primary rv-finish-button"
        disabled={disabled || notReady || submitting}
        aria-busy={submitting}
        onClick={handlePayment}
        data-testid={dataTestId}
      >
        {submitting ? "Finalizando…" : "Finalizar pedido"}
      </button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}
