import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

jest.mock("../../../../../modules/fulfillment/superfrete/servico", () => ({
  invalidarCache: jest.fn(),
}))

import { invalidarCache } from "../../../../../modules/fulfillment/superfrete/servico"

import { GET, PUT } from "../route"

const invalidar = invalidarCache as unknown as jest.Mock

const PAC = {
  id: "so_pac",
  name: "PAC",
  price_type: "calculated",
  data: { servico: "PAC" },
  rules: [{ attribute: "enabled_in_store", value: "true" }],
  type: { code: "pac" },
}

const SEDEX = {
  id: "so_sedex",
  name: "SEDEX",
  price_type: "calculated",
  data: { servico: "SEDEX" },
  rules: [{ attribute: "enabled_in_store", value: "true" }],
  type: { code: "sedex" },
}

function montar(corpo: Record<string, unknown> = {}) {
  const atualizacoes: { id: string; dados: Record<string, unknown> }[] = []

  const req = {
    body: corpo,
    scope: {
      resolve: (chave: string) => {
        if (chave === ContainerRegistrationKeys.QUERY) {
          return { graph: async () => ({ data: [PAC, SEDEX] }) }
        }

        if (chave === Modules.FULFILLMENT) {
          return {
            updateShippingOptions: async (
              id: string,
              dados: Record<string, unknown>
            ) => {
              atualizacoes.push({ id, dados })
              return {}
            },
          }
        }

        return undefined
      },
    },
  }

  const resposta = { status: 0, corpo: undefined as unknown }

  const res = {
    status(codigo: number) {
      resposta.status = codigo
      return res
    },
    json(novo: unknown) {
      resposta.corpo = novo
      if (resposta.status === 0) {
        resposta.status = 200
      }
      return res
    },
  }

  return { req, res, resposta, atualizacoes }
}

beforeEach(() => {
  invalidar.mockReset()
  invalidar.mockResolvedValue(undefined)
})

describe("GET /admin/shipping/servicos", () => {
  it("lista os serviços do SuperFrete com o provider", async () => {
    const { req, res, resposta } = montar()

    await GET(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toMatchObject({ provider: "superfrete_superfrete" })

    const servicos = (resposta.corpo as { servicos: Record<string, unknown>[] })
      .servicos
    expect(servicos.map((servico) => servico.servico)).toEqual(["PAC", "SEDEX"])
  })
})

describe("PUT /admin/shipping/servicos", () => {
  it("400 quando a lista vem vazia", async () => {
    const { req, res, resposta } = montar({ servicos: [] })

    await PUT(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(invalidar).not.toHaveBeenCalled()
  })

  it("404 quando a opção não é do SuperFrete", async () => {
    const { req, res, resposta, atualizacoes } = montar({
      servicos: [{ id: "so_de_outro", ativo: false }],
    })

    await PUT(req as never, res as never)

    expect(resposta.status).toBe(404)
    expect(atualizacoes).toEqual([])
  })

  it("422 quando a escolha desliga o último serviço ativo", async () => {
    const { req, res, resposta, atualizacoes } = montar({
      servicos: [
        { id: "so_pac", ativo: false },
        { id: "so_sedex", ativo: false },
      ],
    })

    await PUT(req as never, res as never)

    expect(resposta.status).toBe(422)
    expect(String((resposta.corpo as Record<string, unknown>).message)).toContain(
      "ao menos um serviço ativo"
    )
    expect(atualizacoes).toEqual([])
  })

  it("desligar um serviço aplica a regra e invalida o cache", async () => {
    const { req, res, resposta, atualizacoes } = montar({
      servicos: [{ id: "so_sedex", ativo: false }],
    })

    await PUT(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toMatchObject({ alterados: 1 })
    expect(atualizacoes).toEqual([
      {
        id: "so_sedex",
        dados: {
          rules: [{ attribute: "enabled_in_store", value: "false", operator: "eq" }],
        },
      },
    ])
    expect(invalidar).toHaveBeenCalledTimes(1)
  })

  it("sem mudança de fato, não invalida cache", async () => {
    const { req, res, resposta, atualizacoes } = montar({
      servicos: [{ id: "so_pac", ativo: true }],
    })

    await PUT(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toMatchObject({ alterados: 0 })
    expect(atualizacoes).toEqual([])
    expect(invalidar).not.toHaveBeenCalled()
  })
})
