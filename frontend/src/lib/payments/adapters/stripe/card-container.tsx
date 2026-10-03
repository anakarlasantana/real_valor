"use client"

/**
 * O container do cartão do Stripe — **temporário**, sai no RV-048.
 * -------------------------------------------------------------------------
 * Saiu de `modules/checkout/components/payment-container/` porque é **UI do
 * provedor**, não do checkout: ele desenha um `<CardElement>`, que só existe
 * porque o Stripe tokeniza cartão na nossa página. Deixá-lo no checkout seria
 * a mesma ferrugem que o registry existe para tirar — um `import` de adapter
 * dentro do componente de pagamento.
 *
 * Com ele aqui, `modules/checkout/` **não importa nenhum adapter**, e o RV-048
 * vira "apagar o diretório `adapters/stripe/`" em vez de editar arquivos
 * espalhados por três pastas.
 */
import { Text } from "@medusajs/ui"
import { useMemo } from "react"
import { CardElement } from "@stripe/react-stripe-js"
import type { StripeCardElementOptions } from "@stripe/stripe-js"

import PaymentContainer from "@modules/checkout/components/payment-container"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"

import type { InlinePaymentUIProps } from "../../types"

import { useStripeContext } from "./index"

/**
 * O `InlineUI` do Stripe.
 *
 * O nome do componente é `StripeCardContainer` porque é o que ele é — mas quem o
 * **chama** é o registry, pelo `adapter.InlineUI`, e nunca o checkout. É essa a
 * diferença que importa: o checkout não sabe que este formulário é de cartão,
 * e não sabe que ele é do Stripe. Quando o Checkout API entrar, ele declara o
 * próprio `InlineUI` e o checkout continua igual.
 */
export const StripeCardContainer = ({
  selected,
  onStatus,
}: InlinePaymentUIProps) => {
  const stripeReady = useStripeContext()

  const useOptions: StripeCardElementOptions = useMemo(() => {
    return {
      style: {
        base: {
          fontFamily: "Inter, sans-serif",
          color: "#424270",
          "::placeholder": {
            color: "rgb(107 114 128)",
          },
        },
      },
      classes: {
        base: "pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out",
      },
    }
  }, [])

  // Enquanto o `Elements` do `Provider` não está pronto, o esqueleto ocupa o
  // lugar — sem ele, o formulário "pula" ao aparecer.
  if (!selected) {
    return null
  }

  return (
    <div className="w-full">
      {stripeReady ? (
          <div className="my-4 transition-all duration-150 ease-in-out">
            <Text className="txt-medium-plus text-ui-fg-base mb-1">
              Dados do cartão
            </Text>
            <CardElement
              options={useOptions}
              onChange={(e) =>
                onStatus({
                  brand:
                    e.brand &&
                    e.brand.charAt(0).toUpperCase() + e.brand.slice(1),
                  error: e.error?.message || null,
                  complete: e.complete,
                })
              }
            />
          </div>
        ) : (
          <SkeletonCardDetails />
        )}
    </div>
  )
}
