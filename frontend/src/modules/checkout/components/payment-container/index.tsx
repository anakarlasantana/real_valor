import { Radio as RadioGroupOption } from "@headlessui/react"
import { Text, clx } from "@medusajs/ui"
import React, { useContext, useMemo } from "react"

import Radio from "@modules/common/components/radio"

import { MANUAL_PROVIDER_ID } from "@rv/contrato/payment"
import { resolvePayment } from "@lib/payments/registry"
import PaymentTest from "../payment-test"

/**
 * O container de um meio de pagamento.
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
 */
export type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  children?: React.ReactNode
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

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      className={clx(
        "flex flex-col gap-y-2 text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
        {
          "border-ui-border-interactive":
            selectedPaymentOptionId === paymentProviderId,
        }
      )}
    >
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-x-4">
          <Radio checked={selectedPaymentOptionId === paymentProviderId} />
          <Text className="text-base-regular">
            {adapter.label}
          </Text>
          {isManual && isDevelopment && (
            <PaymentTest className="hidden small:block" />
          )}
        </div>
        <span className="justify-self-end text-ui-fg-base">
          {adapter.icon}
        </span>
      </div>
      {isManual && isDevelopment && (
        <PaymentTest className="small:hidden text-[10px]" />
      )}
      {children}
    </RadioGroupOption>
  )
}

export default PaymentContainer
