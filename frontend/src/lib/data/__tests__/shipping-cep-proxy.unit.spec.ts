// @vitest-environment jsdom
// jsdom porque o defeito só existe no navegador: no `node`, `ehNavegador()` é falso.
/** O 404 do proxy é rota ausente, e o `fetch` nunca é chamado como método (RV-041). */
import { afterEach, describe, expect, it, vi } from "vitest"

import { buscarCep } from "../shipping-cep"

const PAULISTA = {
  encontrado: true,
  endereco: {
    logradouro: "Avenida Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
  },
}

/** Um `fetch` com a marca do navegador: chamado como método de outro objeto, recusa. */
function fetchDaJanela(this: unknown, _url: string) {
  if (this !== undefined && this !== globalThis) {
    throw new TypeError("Illegal invocation")
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => PAULISTA,
  } as Response)
}

function resposta(corpo: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buscarCep no navegador", () => {
  it("consulta o proxy da mesma origem e devolve o endereço", async () => {
    const espia = vi.fn(fetchDaJanela)

    vi.stubGlobal("fetch", espia)

    await expect(buscarCep("01310100")).resolves.toEqual(PAULISTA)

    expect(espia.mock.calls[0][0]).toBe("/api/cep/01310100")
  })

  it("não chama o fetch como método — é o `Illegal invocation` de verdade", async () => {
    const espia = vi.fn(fetchDaJanela)

    vi.stubGlobal("fetch", espia)

    await buscarCep("01310100")

    // `config.fetchImpl(url)` gravaria o objeto de configuração neste `this`.
    expect(espia.mock.contexts[0]).toBeUndefined()
  })

  it("404 do proxy é rota ausente, não CEP inexistente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => resposta("<html>Not Found</html>", 404))
    )

    await expect(buscarCep("01310100")).resolves.toEqual({
      encontrado: false,
      motivo: "provedor-fora",
    })
  })

  it("502 do proxy (provedores fora) também não vira 'CEP não encontrado'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => resposta({ encontrado: false, motivo: "provedor-fora" }, 502))
    )

    await expect(buscarCep("01310100")).resolves.toEqual({
      encontrado: false,
      motivo: "provedor-fora",
    })
  })
})
