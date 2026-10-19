/**
 * O contrato de `GET /store/orders/track`: o tipo do storefront exigia
 * `payment_status` e a rota nunca o devolvia, sem teste vermelho.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GET } from "../route"

/** O pedido que o banco devolveria. */
const PEDIDO = {
  id: "order_123",
  display_id: 42,
  status: "pending",
  payment_status: "captured",
  created_at: "2026-10-01T10:00:00.000Z",
  total: 15990,
  currency_code: "brl",
  email: "cliente@exemplo.com",
  shipping_address: { first_name: "Ana", city: "Curitiba", province: "PR", postal_code: "80000-000" },
  items: [{ id: "item_1", title: "Tapete", quantity: 1, unit_price: 15990, thumbnail: null }],
  metadata: { cpf: "12345678900" },
}

/**
 * Um `req`/`res` no formato do Express: `res.json` devolve o próprio `res`, e é
 * o que permite a rota terminar com `return res.json(...)`.
 */
function dublar(
  query: Record<string, string>,
  pedidos: unknown[]
): {
  req: MedusaRequest
  res: MedusaResponse
  resposta: { status: number; corpo: any }
} {
  const resposta = { status: 200, corpo: undefined as any }

  const res = {
    status(codigo: number) {
      resposta.status = codigo
      return res
    },
    json(corpo: unknown) {
      resposta.corpo = corpo
      return res
    },
  } as unknown as MedusaResponse

  const req = {
    query,
    scope: {
      resolve: () => ({
        listAndCountOrders: jest.fn().mockResolvedValue([pedidos, pedidos.length]),
      }),
    },
  } as unknown as MedusaRequest

  return { req, res, resposta }
}

describe("GET /store/orders/track", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("exige o número do pedido", async () => {
    const { req, res, resposta } = dublar({ cpf: "12345678900" }, [PEDIDO])

    await GET(req, res)

    expect(resposta.status).toBe(400)
  })

  it("exige CPF ou e-mail — consulta sem identidade é tentativa de listar", async () => {
    const { req, res, resposta } = dublar({ display_id: "42" }, [PEDIDO])

    await GET(req, res)

    expect(resposta.status).toBe(400)
  })

  it("404 quando o pedido não existe", async () => {
    const { req, res, resposta } = dublar({ display_id: "42", cpf: "12345678900" }, [])

    await GET(req, res)

    expect(resposta.status).toBe(404)
  })

  it("403 quando a identidade não bate", async () => {
    const { req, res, resposta } = dublar({ display_id: "42", cpf: "99999999999" }, [PEDIDO])

    await GET(req, res)

    expect(resposta.status).toBe(403)
  })

  it("aceita e-mail no lugar do CPF", async () => {
    const { req, res, resposta } = dublar(
      { display_id: "42", email: "cliente@exemplo.com" },
      [PEDIDO]
    )

    await GET(req, res)

    expect(resposta.status).toBe(200)
  })

  it("devolve TODOS os campos que o tipo do storefront declara", async () => {
    const { req, res, resposta } = dublar({ display_id: "42", cpf: "123-456-789-00" }, [PEDIDO])

    await GET(req, res)

    const pedido = resposta.corpo.order

    // A lista é a que `tracking-types.ts` declara.
    expect(Object.keys(pedido).sort()).toEqual(
      [
        "created_at",
        "currency_code",
        "display_id",
        "id",
        "items",
        "metadata",
        "payment_status",
        "shipping_address",
        "status",
        "total",
        "tracking",
      ].sort()
    )

    expect(pedido.payment_status).toBe("captured")
    expect(Object.keys(pedido.metadata).sort()).toEqual(
      ["cancelado", "order_status_label", "situacao"].sort()
    )
  })

  it("leva ao storefront a situação e o cancelamento gravados no metadata", async () => {
    const cancelado = {
      ...PEDIDO,
      metadata: {
        cpf: "12345678900",
        status_label: "Postada",
        superfrete_situacao: "posted",
        superfrete_cancelada: true,
      },
    }

    const { req, res, resposta } = dublar({ display_id: "42", cpf: "12345678900" }, [
      cancelado,
    ])

    await GET(req, res)

    // É isto que faz a tela dizer "Pedido cancelado".
    expect(resposta.corpo.order.metadata).toEqual({
      order_status_label: "Cancelado",
      situacao: "posted",
      cancelado: true,
    })
  })

  it("o CPF e o e-mail do pedido NÃO saem na resposta", async () => {
    const { req, res, resposta } = dublar({ display_id: "42", cpf: "12345678900" }, [PEDIDO])

    await GET(req, res)

    const json = JSON.stringify(resposta.corpo)

    expect(json).not.toContain("cliente@exemplo.com")
    expect(json).not.toContain("12345678900")
  })
})
