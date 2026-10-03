/**
 * Os rótulos de um meio de pagamento, **sem JSX**.
 * -------------------------------------------------------------------------
 * Existe por causa do `payment-details` do pedido: ele é um **server
 * component** (sem `"use client"`), e o registry (`lib/payments/registry.ts`)
 * importa os adapters — que carregam React e o SDK do Stripe. Um server
 * component não pode importar isso.
 *
 * A solução é a mesma que o projeto já usa em `packages/contrato`: o
 * **vocabulário** (o que um meio é) fica num arquivo sem JSX, e o registry
 * (que sabe o que fazer com ele) fica no lado do cliente. Este é o
 * vocabulário, resumido ao que a página do pedido precisa.
 *
 * O ícone é montado com `createElement` e não com JSX **de propósito**: assim o
 * arquivo é um `.ts`, e não há risco de alguém (ou de um import acidental) o
 * transformar em um módulo client.
 */
import { createElement, type ReactNode } from "react"
import { CreditCard } from "@medusajs/icons"
import {
  MANUAL_PROVIDER_ID,
  STRIPE_PROVIDER_PREFIX,
} from "@rv/contrato/payment"

export type PaymentLabel = {
  title: string
  icon: ReactNode
}

const cardIcon = createElement(CreditCard)

const labels: Record<string, PaymentLabel> = {
  [MANUAL_PROVIDER_ID]: { title: "Pagamento manual", icon: cardIcon },
  [STRIPE_PROVIDER_PREFIX]: { title: "Cartão de crédito", icon: cardIcon },
}

/**
 * O rótulo de um `provider_id`, para a página do pedido.
 *
 * Como no registry, cai por `startsWith` (o Medusa nomeia o provider como
 * `pp_<modulo>_<id>`) e, não encontrando, devolve o próprio id — que é o que a
 * página fazia antes. Um id desconhecido **não** derruba a página.
 */
export function paymentLabel(providerId: string): PaymentLabel {
  const exact = labels[providerId]
  if (exact) {
    return exact
  }

  for (const [id, value] of Object.entries(labels)) {
    if (providerId.startsWith(id)) {
      return value
    }
  }

  return { title: providerId, icon: cardIcon }
}
