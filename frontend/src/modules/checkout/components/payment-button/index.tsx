"use client"

import { resolvePayment } from "@lib/payments/registry"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import React, { useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

/**
 * O botão de finalizar, resolvido pelo registro.
 *
 * **Não há `switch` aqui.** O componente pergunta ao registry quem responde por
 * este `provider_id` e segue o que o adapter disser — é a inversão que o
 * RV-001 existe para fazer. Um provedor novo não acrescenta um `if` aqui.
 *
 * A pergunta que o código fazia antes ("este meio precisa de cartão na minha
 * página?") virou `adapter.fulfillment`: `redirect` vai para o Checkout Pro do
 * provedor, `inline` desenha o meio na nossa página, `external` é só
 * finalizar o pedido. Trocar Checkout Pro por Checkout API é mudar um valor no
 * adapter — não esta linha.
 */
const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  const adapter = resolvePayment(paymentSession?.provider_id)

  // `inline`: o meio tem uma confirmação própria — hoje, o cartão do Stripe,
  // que precisa mandar os dados ao provedor antes de finalizar o pedido.
  // Quem tem o botão é o ADAPTER; o checkout não sabe qual é.
  if (adapter.ConfirmButton) {
    return (
      <adapter.ConfirmButton
        notReady={notReady}
        cart={cart}
        data-testid={dataTestId}
      />
    )
  }

  // `redirect` e `external`: o botão é o mesmo — finalizar o pedido. O que
  // muda entre os dois é o que acontece ANTES (a preference já foi criada e a
  // cliente foi redirecionada) ou se há cobrança a fazer por fora.
  return (
    <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
  )
}

/**
 * O botão de finalizar, comum a `redirect` e `external`.
 *
 * O nome é o do meio manual porque é o que ele sempre foi: o botão que chama
 * `placeOrder()`. Ele não sabe que meio está ativo, e é por isso que o mesmo
 * botão serve para o Mercado Pago (que já autorizou fora) e para o meio manual
 * (que não autorizou nada). O RV-048 renomeia, junto com a remoção do Stripe.
 */
const ManualTestPaymentButton = ({
  notReady,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  "data-testid"?: string
}) => {
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

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <button
        type="button"
        className="rv-btn rv-btn-primary rv-finish-button"
        disabled={notReady || submitting}
        aria-busy={submitting}
        onClick={handlePayment}
        data-testid={dataTestId}
      >
        {submitting ? "Finalizando…" : "Finalizar pedido"}
      </button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
