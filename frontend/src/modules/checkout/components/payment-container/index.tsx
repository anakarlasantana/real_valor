"use client"

import { Radio as RadioGroupOption } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import React from "react"

import { resolvePayment } from "@lib/payments/registry"
import { MANUAL_PROVIDER_ID } from "@rv/contrato/payment"

import PaymentTest from "../payment-test"

/**
 * O container de um meio de pagamento — a linha do passo 3.
 *
 * **O `paymentInfoMap` não vem mais por prop.** Antes o pai injetava o mapa
 * inteiro, e este arquivo dependia de `isManual` para saber se devia mostrar o
 * `PaymentTest`. Agora os dois saem do registry: o nome e o ícone são
 * `resolvePayment(id).label` e `.icon`, e o `PaymentTest` aparece para o meio
 * cujo `id` é o manual do contrato (`MANUAL_PROVIDER_ID`).
 *
 * A consequência é que o pai (`payment/index.tsx`) deixa de conhecer o mapa —
 * ele só passa o id. Um provedor novo não acrescenta entrada em lugar nenhum
 * aqui.
 *
 * A linha de apoio (`<small>`) sai do `fulfillment` do adapter, e não de um texto
 * por provedor: é o **que acontece a seguir** ("você conclui no ambiente do
 * provedor", "os dados do cartão são preenchidos aqui"), que é o que a cliente
 * precisa saber antes de escolher. Não há taxa nem prazo nesta linha: a referência
 * anuncia "5% de desconto" no Pix e "até 6x sem juros", e nenhum dos dois está
 * configurado na loja — o resumo da sacola já recusou esse número pelo mesmo
 * motivo, e ele não entra por outra porta.
 */
export type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  children?: React.ReactNode
}

/** O que dizer da linha de apoio, por modo de conclusão do meio. */
const SUPPORT_LINE: Record<string, string> = {
  inline: "Informe os dados do cartão aqui nesta página.",
  redirect: "Você conclui o pagamento no ambiente do provedor.",
  external: "Nada a preencher: o pedido é finalizado direto.",
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const adapter = resolvePayment(paymentProviderId)
  const isManual = paymentProviderId === MANUAL_PROVIDER_ID
  const supportLine = SUPPORT_LINE[adapter.fulfillment]

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      className={clx("rv-payment-option", {
        "rv-option-selected": selectedPaymentOptionId === paymentProviderId,
        "rv-option-disabled": disabled,
      })}
    >
      <span className="rv-option-row">
        <span
          className="rv-choice"
          aria-hidden="true"
          data-testid="radio-button"
        />
        <span className="rv-option-body">
          <strong data-testid="payment-option-label">{adapter.label}</strong>
          {supportLine && <small>{supportLine}</small>}
          {isManual && isDevelopment && <PaymentTest />}
        </span>
        <span className="rv-option-price">{adapter.icon}</span>
      </span>
      {children}
    </RadioGroupOption>
  )
}

export default PaymentContainer
