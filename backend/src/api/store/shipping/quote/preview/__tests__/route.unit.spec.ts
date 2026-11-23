import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

jest.mock("../../../../../../modules/fulfillment/superfrete/servico", () => ({
  cotarPedido: jest.fn(),
}))

import { cotarPedido } from "../../../../../../modules/fulfillment/superfrete/servico"

import { GET } from "../route"

const cotar = cotarPedido as unknown as jest.Mock

const VARIANTE = { id: "variant_1", weight: 300 }

function montar(query: Record<string, string>, variantes: unknown[] = [VARIANTE]) {
  const chamadas: string[] = []

  const graph = jest.fn(async ({ entity }: Record<string, unknown>) => {
    chamadas.push(String(entity))

    if (entity === "variant") {
      return { data: variantes }
    }

    return { data: [{ id: "loc_1", address: { postal_code: "01310100" } }] }
  })

  const req = {
    query,
    scope: {
      resolve: (chave: string) =>
        chave === ContainerRegistrationKeys.QUERY ? { graph } : undefined,
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

  return { req, res, resposta, graph, chamadas }
}

beforeEach(() => {
  cotar.mockReset()
  cotar.mockResolvedValue({
    ok: true,
    cotacoes: [{ servico: "PAC", nome: "PAC", preco: 1990, prazo: 5 }],
    volumes: 1,
    pesoGramas: 300,
    origem: "memoria",
  })
})

describe("GET /store/shipping/quote/preview", () => {
  it("400 quando o CEP não tem oito dígitos", async () => {
    const { req, res, resposta } = montar({
      postal_code: "0131",
      variant_id: "variant_1",
    })

    await GET(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(cotar).not.toHaveBeenCalled()
  })

  it("400 quando falta a variação", async () => {
    const { req, res, resposta } = montar({ postal_code: "01310100" })

    await GET(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(cotar).not.toHaveBeenCalled()
  })

  it("400 quando a quantidade é zero", async () => {
    const { req, res, resposta } = montar({
      postal_code: "01310100",
      variant_id: "variant_1",
      quantity: "0",
    })

    await GET(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(cotar).not.toHaveBeenCalled()
  })

  it("404 quando a variação não existe", async () => {
    const { req, res, resposta } = montar(
      { postal_code: "01310100", variant_id: "variant_x" },
      []
    )

    await GET(req as never, res as never)

    expect(resposta.status).toBe(404)
    expect(cotar).not.toHaveBeenCalled()
  })

  it("cota pelo peso da variação e pelo CEP de origem do estoque", async () => {
    const { req, res, resposta } = montar({
      postal_code: "60352-680",
      variant_id: "variant_1",
      quantity: "2",
    })

    await GET(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(cotar).toHaveBeenCalledWith(
      expect.objectContaining({
        cepOrigem: "01310100",
        cepDestino: "60352680",
        itens: [{ quantidade: 2, peso_gramas: 300 }],
      })
    )
    expect(resposta.corpo).toMatchObject({
      volumes: 1,
      peso_gramas: 300,
      cotacoes: [{ servico: "PAC", preco: 1990 }],
    })
  })

  it("sem peso na variação, cota mesmo assim", async () => {
    const { req, res, resposta } = montar(
      { postal_code: "01310100", variant_id: "variant_1" },
      [{ id: "variant_1", weight: null }]
    )

    await GET(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(cotar).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [{ quantidade: 1, peso_gramas: null }],
      })
    )
  })

  it("repassa a recusa da cotação com o status dela", async () => {
    cotar.mockResolvedValue({
      ok: false,
      status: 422,
      origem: "rede",
      erro: "Nenhuma caixa ativa serve para os Correios. Confira os pacotes.",
    })

    const { req, res, resposta } = montar({
      postal_code: "01310100",
      variant_id: "variant_1",
    })

    await GET(req as never, res as never)

    expect(resposta.status).toBe(422)
    expect(resposta.corpo).toMatchObject({
      message: "Nenhuma caixa ativa serve para os Correios. Confira os pacotes.",
      origem: "rede",
    })
  })
})
