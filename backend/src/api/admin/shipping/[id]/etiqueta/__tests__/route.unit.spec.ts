import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

jest.mock("../../../../../../modules/fulfillment/superfrete/cliente", () => ({
  ambienteDaConfig: () => "sandbox",
  chamarSuperFrete: jest.fn(),
}))

import { chamarSuperFrete } from "../../../../../../modules/fulfillment/superfrete/cliente"

import { POST } from "../route"

const chamar = chamarSuperFrete as unknown as jest.Mock

const PEDIDO = {
  id: "order_1",
  display_id: 42,
  email: "ana@exemplo.com",
  payment_status: "captured",
  fulfillment_status: "not_fulfilled",
  metadata: { cpf: "12345678900" },
  customer: { first_name: "Ana", last_name: "Silva", phone: "85999990000" },
  shipping_address: {
    first_name: "Ana",
    last_name: "Silva",
    address_1: "Rua A, 100",
    city: "Fortaleza",
    province: "CE",
    postal_code: "60352680",
    phone: "85999990000",
    metadata: { numero: "100", bairro: "Alvaro Weyne" },
  },
  items: [
    { title: "Vestido", product_title: "Vestido", quantity: 1, unit_price: 199.9 },
  ],
  shipping_methods: [{ shipping_option_id: "so_1", data: { servico: "PAC" } }],
}

const LOCAL = {
  id: "loc_1",
  name: "CD Real Valor",
  metadata: { documento: "12345678000199", email: "cd@exemplo.com" },
  address: {
    address_1: "Rua B",
    address_2: "200",
    city: "Fortaleza",
    province: "CE",
    postal_code: "01310100",
    phone: "85988887777",
    metadata: { numero: "200", bairro: "Centro" },
  },
}

const CAIXA = {
  id: "cx_1",
  nome: "Caixa M",
  peso_gramas: 400,
  altura_cm: 10,
  largura_cm: 20,
  comprimento_cm: 30,
  padrao: true,
  ativo: true,
}

function montar(pedido: Record<string, unknown> | null = PEDIDO) {
  const atualizacoes: { ids: string[]; dados: Record<string, unknown> }[] = []

  const graph = jest.fn(async ({ entity }: Record<string, unknown>) =>
    entity === "order"
      ? { data: pedido ? [pedido] : [] }
      : { data: [LOCAL] }
  )

  const req = {
    params: { id: "order_1" },
    scope: {
      resolve: (chave: string) => {
        if (chave === ContainerRegistrationKeys.QUERY) {
          return { graph }
        }

        if (chave === "order") {
          return {
            updateOrders: jest.fn(
              async (ids: string[], dados: Record<string, unknown>) => {
                atualizacoes.push({ ids, dados })
                return {}
              }
            ),
          }
        }

        return { listar: async () => [CAIXA] }
      },
    },
  }

  const resposta = { status: 0, corpo: undefined as unknown }

  const res = {
    status(codigo: number) {
      resposta.status = codigo
      return res
    },
    json(corpo: unknown) {
      resposta.corpo = corpo
      if (resposta.status === 0) {
        resposta.status = 200
      }
      return res
    },
  }

  return { req, res, resposta, atualizacoes, graph }
}

beforeEach(() => {
  chamar.mockReset()
  chamar.mockImplementation(async ({ caminho }: { caminho: string }) =>
    caminho === "/api/v0/cart" ? { id: "etq_1", price: 23.45 } : {}
  )
})

describe("POST /admin/shipping/:id/etiqueta", () => {
  it("404 quando o pedido não existe", async () => {
    const { req, res, resposta } = montar(null)

    await POST(req as never, res as never)

    expect(resposta.status).toBe(404)
    expect(chamar).not.toHaveBeenCalled()
  })

  it("409 quando o pedido já tem etiqueta — e não chama o provedor", async () => {
    const { req, res, resposta } = montar({
      ...PEDIDO,
      metadata: { cpf: "12345678900", superfrete_id: "etq_antiga" },
    })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(409)
    expect(resposta.corpo).toMatchObject({ etiqueta: "etq_antiga" })
    expect(chamar).not.toHaveBeenCalled()
  })

  it("422 quando a opção de frete não é dos Correios", async () => {
    const { req, res, resposta } = montar({ ...PEDIDO, shipping_methods: [] })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(422)
    expect(chamar).not.toHaveBeenCalled()
  })

  it("201 no caminho feliz, gravando o metadata sem perder o CPF", async () => {
    const { req, res, resposta, atualizacoes } = montar()

    await POST(req as never, res as never)

    expect(resposta.status).toBe(201)
    expect(resposta.corpo).toMatchObject({ etiqueta: "etq_1", preco: 2345 })
    expect(chamar).toHaveBeenCalledTimes(2)

    const metadata = atualizacoes[0].dados.metadata as Record<string, unknown>
    expect(atualizacoes[0].ids).toEqual(["order_1"])
    expect(metadata.cpf).toBe("12345678900")
    expect(metadata.superfrete_id).toBe("etq_1")
    expect(String(metadata.carrier)).not.toBe("")
    expect(String(metadata.tracking_url)).toContain("etq_1")
    expect(String(metadata.status_label)).not.toBe("")
  })

  it("saldo insuficiente no pagamento da etiqueta: avisa e não grava nada", async () => {
    chamar.mockImplementation(async ({ caminho }: { caminho: string }) => {
      if (caminho === "/api/v0/cart") {
        return { id: "etq_1", price: 23.45 }
      }

      throw Object.assign(new Error("Saldo insuficiente."), { status: 400 })
    })

    const { req, res, resposta, atualizacoes } = montar()

    await POST(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(String((resposta.corpo as Record<string, unknown>).message)).toContain(
      "saldo da carteira"
    )
    expect(atualizacoes).toEqual([])
  })
})
