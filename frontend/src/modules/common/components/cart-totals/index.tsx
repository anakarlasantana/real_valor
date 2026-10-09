"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
  }
}

/**
 * As linhas de valor do resumo — subtotal, frete, desconto, impostos e total.
 *
 * Os rótulos estavam **em inglês** ("Subtotal (excl. shipping and taxes)",
 * "Shipping", "Discount", "Taxes") numa loja pt-BR: o mesmo defeito do RV-003, no
 * lugar em que ele custa mais caro, que é a última tela antes de pagar. Agora são
 * quatro palavras em português e uma regra: **linha de valor que é zero ou não
 * existe, não é desenhada** — com a exceção do frete, que aparece como "Grátis"
 * (o zero dele é uma boa notícia, e não um vazio).
 *
 * Os `data-testid` continuam os mesmos: são o contrato dos testes de ponta a
 * ponta, e mudá-los seria quebrar a medida para melhorar o texto.
 */
const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    item_subtotal,
    shipping_subtotal,
    discount_subtotal,
  } = totals

  const dinheiro = (valor: number | null | undefined) =>
    convertToLocale({ amount: valor ?? 0, currency_code })

  const freteGratis = !shipping_subtotal

  return (
    <div>
      <div className="rv-summary-row">
        <span>Subtotal</span>
        <span data-testid="cart-subtotal" data-value={item_subtotal || 0}>
          {dinheiro(item_subtotal)}
        </span>
      </div>

      <div className="rv-summary-row">
        <span>Frete</span>
        <span
          className={freteGratis ? "rv-success" : undefined}
          data-testid="cart-shipping"
          data-value={shipping_subtotal || 0}
        >
          {freteGratis ? "Grátis" : dinheiro(shipping_subtotal)}
        </span>
      </div>

      {!!discount_subtotal && (
        <div className="rv-summary-row">
          <span>Desconto</span>
          <span data-testid="cart-discount" data-value={discount_subtotal || 0}>
            - {dinheiro(discount_subtotal)}
          </span>
        </div>
      )}

      {!!tax_total && (
        <div className="rv-summary-row">
          <span>Impostos</span>
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {dinheiro(tax_total)}
          </span>
        </div>
      )}

      <div className="rv-summary-row rv-summary-total">
        <span>Total</span>
        <strong data-testid="cart-total" data-value={total || 0}>
          {dinheiro(total)}
        </strong>
      </div>
    </div>
  )
}

export default CartTotals
