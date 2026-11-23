import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: (...args: unknown[]) => fetchMock(...args) } },
}))

const { setCepMock } = vi.hoisted(() => ({ setCepMock: vi.fn() }))

vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: async () => ({ "x-publishable-api-key": "pk_teste" }),
  setCepHerdado: (...args: unknown[]) => setCepMock(...args),
}))

import { FALHA_NA_COTACAO, SEM_OPCAO } from "@lib/checkout/cep-frete"

import { cotarNaPeca } from "../frete"

beforeEach(() => {
  fetchMock.mockReset()
  setCepMock.mockReset()
})

describe("cotarNaPeca", () => {
  it("converte centavos em reais e o prazo em palavras", async () => {
    fetchMock.mockResolvedValue({
      cotacoes: [{ servico: "PAC", nome: "PAC", preco: 1990, prazo: 5 }],
    })

    await expect(
      cotarNaPeca({ cep: "01310100", variantId: "variant_1" })
    ).resolves.toEqual({
      ok: true,
      opcoes: [{ titulo: "PAC", prazo: "até 5 dias úteis", preco: 19.9, moeda: "brl" }],
    })
    expect(setCepMock).toHaveBeenCalledWith("01310100")
  })

  it("manda CEP, variação e quantidade, sem cache", async () => {
    fetchMock.mockResolvedValue({ cotacoes: [] })

    await cotarNaPeca({ cep: "01310100", variantId: "variant_1", quantidade: 2 })

    expect(fetchMock).toHaveBeenCalledWith(
      "/store/shipping/quote/preview",
      expect.objectContaining({
        method: "GET",
        query: { postal_code: "01310100", variant_id: "variant_1", quantity: 2 },
        cache: "no-store",
      })
    )
  })

  it("resposta sem cotação é 'sem entrega', não erro", async () => {
    fetchMock.mockResolvedValue({ cotacoes: [] })

    await expect(
      cotarNaPeca({ cep: "01310100", variantId: "variant_1" })
    ).resolves.toEqual({ ok: false, mensagem: SEM_OPCAO })
    expect(setCepMock).not.toHaveBeenCalled()
  })

  it("rede fora devolve mensagem de falha, sem lançar", async () => {
    fetchMock.mockRejectedValue(new Error("502"))

    await expect(
      cotarNaPeca({ cep: "01310100", variantId: "variant_1" })
    ).resolves.toEqual({ ok: false, mensagem: FALHA_NA_COTACAO })
  })

  it("cotação sem título é descartada em vez de virar linha vazia", async () => {
    fetchMock.mockResolvedValue({
      cotacoes: [{ servico: "", nome: "   ", preco: 100, prazo: 3 }],
    })

    await expect(
      cotarNaPeca({ cep: "01310100", variantId: "variant_1" })
    ).resolves.toEqual({ ok: false, mensagem: SEM_OPCAO })
  })
})
