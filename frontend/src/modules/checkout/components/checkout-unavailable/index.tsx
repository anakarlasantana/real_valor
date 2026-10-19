import { CreditCard, ExclamationCircle, TruckFast } from "@medusajs/icons"
import type { ElementType } from "react"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * O checkout que não pode ser feito — e diz por quê. Substitui o `return null`
 * que sumia com o formulário e deixava só o resumo, sem explicar se o problema
 * era o endereço, a transportadora ou a loja. Cada motivo tem a sua saída:
 * conferir o endereço, tentar de novo ou voltar para a sacola.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
export type MotivoIndisponivel =
  | "entrega-sem-opcoes"
  | "entrega-indisponivel"
  | "pagamento"

const CONTEUDO: Record<
  MotivoIndisponivel,
  {
    icon: ElementType
    title: string
    text: string
    acao: { href: string; label: string }
    saida: { href: string; label: string }
  }
> = {
  "entrega-sem-opcoes": {
    icon: TruckFast,
    title: "Não há entrega para este endereço",
    text: "Nenhuma transportadora atende o CEP informado. Confira o endereço na sacola ou fale com a loja — as peças continuam guardadas para você.",
    acao: { href: "/cart", label: "Conferir endereço na sacola" },
    saida: { href: "/store", label: "Continuar comprando" },
  },
  "entrega-indisponivel": {
    icon: ExclamationCircle,
    title: "Não conseguimos calcular a entrega",
    text: "A transportadora não respondeu agora. Suas peças continuam na sacola — tente de novo em alguns minutos.",
    acao: { href: "/checkout", label: "Tentar novamente" },
    saida: { href: "/cart", label: "Voltar para a sacola" },
  },
  pagamento: {
    icon: CreditCard,
    title: "Pagamento indisponível no momento",
    text: "Nenhum meio de pagamento está ativo para esta região. Suas peças continuam na sacola — tente de novo em alguns minutos ou fale com a loja.",
    acao: { href: "/checkout", label: "Tentar novamente" },
    saida: { href: "/cart", label: "Voltar para a sacola" },
  },
}

export default function CheckoutUnavailable({
  motivo,
}: {
  motivo: MotivoIndisponivel
}) {
  const { icon: Icon, title, text, acao, saida } = CONTEUDO[motivo]

  return (
    <section className="rv-checkout-form" data-testid="checkout-unavailable">
      <div className="rv-checkout-title">
        <span className="rv-eyebrow text-rv-rose-strong">
          Finalize sua compra
        </span>
        <h1>Checkout</h1>
      </div>

      <EmptyState
        icon={<Icon aria-hidden="true" focusable="false" />}
        title={title}
        text={text}
        data-testid="checkout-unavailable-message"
      >
        <div className="rv-checkout-unavailable-actions">
          <LocalizedClientLink href={acao.href} className="rv-btn rv-btn-primary">
            {acao.label}
          </LocalizedClientLink>
          <LocalizedClientLink
            href={saida.href}
            className="rv-btn rv-btn-secondary"
          >
            {saida.label}
          </LocalizedClientLink>
        </div>
      </EmptyState>
    </section>
  )
}
