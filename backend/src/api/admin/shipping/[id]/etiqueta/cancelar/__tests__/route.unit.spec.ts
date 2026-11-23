import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { situacaoDaEtiqueta } from "../../../../../../../modules/fulfillment/superfrete/etiqueta"

jest.mock("../../../../../../../modules/fulfillment/superfrete/cliente", () => ({
  ambienteDaConfig: () => "sandbox",
  chamarSuperFrete: jest.fn(async () => ({})),
}))

import { chamarSuperFrete } from "../../../../../../../modules/fulfillment/superfrete/cliente"

import { POST } from "../route"

const PEDIDO = {
  id: "order_1",
  metadata: {
    cpf: "12345678900",
    superfrete_id: "etq_abc",
    tracking_number: "AA123456789BR",
    carrier: "Correios",
    status_label: "Postada",
  },
}

function montar(pedido: unknown = PEDIDO) {
  const atualizacoes: { ids: string[]; dados: Record<string, unknown> }[] = []

  const query = {
    graph: jest.fn(async () => ({ data: pedido === undefined ? [] : [pedido] })),
  }

  const ordenar = {
    updateOrders: jest.fn(
      async (ids: string[], dados: Record<string, unknown>) => {
        atualizacoes.push({ ids, dados })
        return {}
      }
    ),
  }

  const req = {
    params: { id: "order_1" },
    body: { motivo: "cliente desistiu" },
    scope: {
      resolve: (chave: string) =>
        chave === ContainerRegistrationKeys.QUERY ? query : ordenar,
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
      return res
    },
  }

  return { req, res, resposta, atualizacoes }
}

const chamar = chamarSuperFrete as unknown as jest.Mock

beforeEach(() => {
  chamar.mockReset()
  chamar.mockResolvedValue({})
  process.env.SUPERFRETE_TOKEN = ""
})

describe("POST /admin/shipping/:id/etiqueta/cancelar", () => {
  it("404 quando o pedido não existe", async () => {
    const { req, res, resposta, atualizacoes } = montar(null)

    await POST(req as never, res as never)

    expect(resposta.status).toBe(404)
    expect(atualizacoes).toEqual([])
  })

  it("409 quando o pedido não tem etiqueta", async () => {
    const semEtiqueta = { id: "order_1", metadata: { cpf: "12345678900" } }
    const { req, res, resposta, atualizacoes } = montar(semEtiqueta)

    await POST(req as never, res as never)

    expect(resposta.status).toBe(409)
    expect(atualizacoes).toEqual([])
  })

  it("preserva o metadata do pedido e marca o cancelamento", async () => {
    const { req, res, resposta, atualizacoes } = montar()

    await POST(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toMatchObject({ cancelada: "etq_abc" })

    const metadata = atualizacoes[0].dados.metadata as Record<string, unknown>
    expect(atualizacoes[0].ids).toEqual(["order_1"])
    expect(metadata.cpf).toBe("12345678900")
    expect(metadata.tracking_number).toBe("AA123456789BR")
    expect(metadata.carrier).toBe("Correios")
    expect(metadata.superfrete_cancelada).toBe("etq_abc")
    expect(metadata.status_label).toBe(situacaoDaEtiqueta("cancelled"))
  })

  it("propaga o status da transportadora e não grava nada quando a recusa vem", async () => {
    const { req, res, resposta, atualizacoes } = montar()

    chamar.mockRejectedValue(
      Object.assign(new Error("Etiqueta já postada."), { status: 422 })
    )

    await POST(req as never, res as never)

    expect(resposta.status).toBe(422)
    expect(resposta.corpo).toMatchObject({ message: "Etiqueta já postada." })
    expect(atualizacoes).toEqual([])
  })
})
