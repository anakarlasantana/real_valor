import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

jest.mock("../../../../../modules/fulfillment/superfrete/servico", () => ({
  testarCotacao: jest.fn(),
}))

import { testarCotacao } from "../../../../../modules/fulfillment/superfrete/servico"

import { POST } from "../route"

const testar = testarCotacao as unknown as jest.Mock

const OPCAO_ATIVA = {
  id: "so_pac",
  name: "PAC",
  price_type: "calculated",
  data: { servico: "PAC" },
  rules: [{ attribute: "enabled_in_store", value: "true" }],
  type: { code: "pac" },
}

const OPCAO_DESLIGADA = {
  id: "so_sedex",
  name: "SEDEX",
  price_type: "calculated",
  data: { servico: "SEDEX" },
  rules: [{ attribute: "enabled_in_store", value: "false" }],
  type: { code: "sedex" },
}

function montar(corpo: Record<string, unknown>, opcoes: unknown[] = [OPCAO_ATIVA, OPCAO_DESLIGADA]) {
  const req = {
    body: corpo,
    scope: {
      resolve: (chave: string) => {
        if (chave === ContainerRegistrationKeys.QUERY) {
          return {
            graph: async ({ entity }: Record<string, unknown>) =>
              entity === "shipping_option"
                ? { data: opcoes }
                : { data: [{ address: { postal_code: "01310100" } }] },
          }
        }

        return { listar: async () => [] }
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

  return { req, res, resposta }
}

beforeEach(() => {
  testar.mockReset()
  testar.mockResolvedValue({
    ok: true,
    cotacoes: [
      { servico: "PAC", nome: "PAC", preco: 1990, prazo: 5 },
      { servico: "SEDEX", nome: "SEDEX", preco: 3490, prazo: 3 },
    ],
    pesoGramas: 400,
    requisicao: { metodo: "POST", url: "https://sandbox/api/v0/calculator" },
    latenciaMs: 120,
    origem: "rede",
  })
  process.env.SUPERFRETE_TOKEN = "token-de-teste"
})

describe("POST /admin/shipping/testar", () => {
  it("400 quando o CEP não tem oito dígitos", async () => {
    const { req, res, resposta } = montar({ cep: "0131" })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(testar).not.toHaveBeenCalled()
  })

  it("409 quando não há serviço nenhum para cotar", async () => {
    const { req, res, resposta } = montar({ cep: "01310100" }, [])

    await POST(req as never, res as never)

    expect(resposta.status).toBe(409)
    expect(testar).not.toHaveBeenCalled()
  })

  it("cota e marca cada serviço como ativo ou desligado", async () => {
    const { req, res, resposta } = montar({ cep: "60352-680" })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toMatchObject({
      testados: ["PAC"],
      pesoGramas: 400,
      ambiente: "sandbox",
    })

    const cotacoes = (resposta.corpo as { cotacoes: Record<string, unknown>[] })
      .cotacoes
    expect(cotacoes).toHaveLength(2)
    expect(cotacoes[0]).toMatchObject({ servico: "PAC", ativo: true })
    expect(cotacoes[1]).toMatchObject({ servico: "SEDEX", ativo: false })

    expect(testar).toHaveBeenCalledWith(
      expect.objectContaining({ cepOrigem: "01310100", cepDestino: "60352680" })
    )
  })

  it("quando `todos` vem, testa também os desligados", async () => {
    const { req, res, resposta } = montar({ cep: "01310100", todos: true })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(200)
    expect((resposta.corpo as { testados: string[] }).testados).toEqual([
      "PAC",
      "SEDEX",
    ])
  })

  it("erro do provedor leva a requisição que saiu, para o painel explicar", async () => {
    testar.mockResolvedValue({
      ok: false,
      status: 400,
      erro: "A transportadora recusou o corpo.",
      requisicao: { metodo: "POST", url: "https://sandbox/api/v0/calculator" },
      latenciaMs: 90,
    })

    const { req, res, resposta } = montar({ cep: "01310100" })

    await POST(req as never, res as never)

    expect(resposta.status).toBe(400)
    expect(resposta.corpo).toMatchObject({
      message: "A transportadora recusou o corpo.",
      latenciaMs: 90,
    })
  })
})
