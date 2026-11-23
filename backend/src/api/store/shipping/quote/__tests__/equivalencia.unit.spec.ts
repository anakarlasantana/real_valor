import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

jest.mock("../../../../../modules/fulfillment/superfrete/servico", () => ({
  cotarPedido: jest.fn(),
}))

import { cotarPedido } from "../../../../../modules/fulfillment/superfrete/servico"

import { GET as cotarNoCarrinho } from "../route"
import { GET as cotarNaPeca } from "../preview/route"

const cotar = cotarPedido as unknown as jest.Mock

const CEP = "60352680"
const PESO = 300

const COTACOES = [
  { servico: "PAC", nome: "PAC", preco: 1990, prazo: 5 },
  { servico: "SEDEX", nome: "SEDEX", preco: 3490, prazo: 3 },
]

function resposta() {
  const alvo = { status: 0, corpo: undefined as unknown }

  const res = {
    status(codigo: number) {
      alvo.status = codigo
      return res
    },
    json(corpo: unknown) {
      alvo.corpo = corpo
      if (alvo.status === 0) {
        alvo.status = 200
      }
      return res
    },
  }

  return { res, alvo }
}

function carrinho() {
  const { res, alvo } = resposta()

  const req = {
    query: { cart_id: "cart_1", postal_code: CEP },
    scope: {
      resolve: (chave: string) => {
        if (chave === Modules.CART) {
          return {
            retrieveCart: async () => ({
              id: "cart_1",
              items: [{ quantity: 1, variant: { weight: PESO } }],
              shipping_address: { postal_code: CEP },
            }),
          }
        }

        if (chave === ContainerRegistrationKeys.QUERY) {
          return {
            graph: async () => ({
              data: [{ id: "loc_1", address: { postal_code: "01310100" } }],
            }),
          }
        }

        return undefined
      },
    },
  }

  return { req, res, alvo }
}

function previa() {
  const { res, alvo } = resposta()

  const req = {
    query: { postal_code: CEP, variant_id: "variant_1", quantity: "1" },
    scope: {
      resolve: (chave: string) =>
        chave === ContainerRegistrationKeys.QUERY
          ? {
              graph: async ({ entity }: Record<string, unknown>) =>
                entity === "variant"
                  ? { data: [{ id: "variant_1", weight: PESO }] }
                  : {
                      data: [
                        { id: "loc_1", address: { postal_code: "01310100" } },
                      ],
                    },
            }
          : undefined,
    },
  }

  return { req, res, alvo }
}

beforeEach(() => {
  cotar.mockReset()
  cotar.mockResolvedValue({
    ok: true,
    cotacoes: COTACOES,
    volumes: 1,
    pesoGramas: PESO,
    origem: "memoria",
  })
})

describe("a prévia da PDP e a cotação do carrinho", () => {
  it("chamam a mesma função com o mesmo CEP, o mesmo peso e os mesmos serviços", async () => {
    const doCarrinho = carrinho()
    await cotarNoCarrinho(doCarrinho.req as never, doCarrinho.res as never)

    const daPeca = previa()
    await cotarNaPeca(daPeca.req as never, daPeca.res as never)

    expect(cotar).toHaveBeenCalledTimes(2)

    const [primeira, segunda] = cotar.mock.calls.map(([entrada]) => entrada)

    expect(segunda.cepOrigem).toBe(primeira.cepOrigem)
    expect(segunda.cepDestino).toBe(primeira.cepDestino)
    expect(segunda.itens).toEqual(primeira.itens)
    expect(segunda.servicos).toEqual(primeira.servicos)
  })

  it("devolvem exatamente o mesmo corpo para a mesma entrada", async () => {
    const doCarrinho = carrinho()
    await cotarNoCarrinho(doCarrinho.req as never, doCarrinho.res as never)

    const daPeca = previa()
    await cotarNaPeca(daPeca.req as never, daPeca.res as never)

    expect(doCarrinho.alvo.status).toBe(200)
    expect(daPeca.alvo.status).toBe(200)
    expect(daPeca.alvo.corpo).toEqual(doCarrinho.alvo.corpo)
  })
})
