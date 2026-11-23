import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PedidoEncontrado } from ".."

const encontrado = {
  situacao: "encontrado",
  dados: {
    order: {
      id: "order_01",
      display_id: 123,
      email: "cliente@e2e.realvalor.test",
      status: "pending",
      payment_status: "captured",
      created_at: "2026-11-17T00:00:00Z",
      total: 199.9,
      currency_code: "brl",
      shipping_address: {
        first_name: "Cliente",
        city: "Fortaleza",
        province: "CE",
        postal_code: "60352680",
      },
      items: [
        {
          id: "item_1",
          title: "[e2e] Vestido de Teste",
          quantity: 1,
          unit_price: 199.9,
          thumbnail: null,
        },
        {
          id: "item_2",
          title: "Cinto de Teste",
          quantity: 2,
          unit_price: 19.9,
          thumbnail: null,
        },
      ],
      tracking: {
        tracking_number: "AA123456789BR",
        tracking_url: null,
        carrier: "Correios",
      },
      metadata: {
        order_status_label: "Em processamento",
        situacao: null,
        cancelado: false,
      },
    },
  },
} as never

describe("PedidoEncontrado", () => {
  it("mostra pedido, itens e situação", () => {
    const markup = renderToStaticMarkup(
      <PedidoEncontrado resultado={encontrado} />
    )

    expect(markup).toContain("Pedido #123")
    expect(markup).toContain("Em processamento")
    expect(markup).toContain("1× [e2e] Vestido de Teste")
    expect(markup).toContain("2× Cinto de Teste")
    expect(markup).toContain("Correios")
    expect(markup).toContain("AA123456789BR")
  })

  it("não inventa link de rastreio quando o pedido não tem URL", () => {
    const markup = renderToStaticMarkup(
      <PedidoEncontrado resultado={encontrado} />
    )

    expect(markup).not.toContain("Acompanhar na transportadora")
  })
})