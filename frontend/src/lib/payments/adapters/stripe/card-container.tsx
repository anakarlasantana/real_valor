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
 *
 * O que vestimos aqui é a **moldura**, porque o `CardElement` é um `iframe` de
 * terceiro e não aceita classe nossa por dentro: `classes.base` recebe o
 * `.rv-card-input` (48px, filete de 1px, `--rv-offwhite`), e o rótulo acima usa o
 * `.rv-card-field` do `brand.css` — as mesmas medidas dos outros campos. O
 * `style.base` do Stripe continua mandando na tipografia e na cor de dentro, que é
 * onde ele é dono e nós não somos.
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
          fontFamily: "Montserrat, system-ui, sans-serif",
          fontSize: "14px",
          color: "#171717",
          "::placeholder": {
            color: "#6f6a66",
          },
        },
      },
      classes: {
        base: "rv-card-input",
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
        <div className="rv-card-field">
          <span>Dados do cartão</span>
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
