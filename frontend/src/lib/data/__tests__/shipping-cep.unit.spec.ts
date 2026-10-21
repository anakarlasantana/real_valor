/**
 * O CEP que preenche o endereço — e o que acontece quando ele não pode.
 * A regra: a busca nunca lança (o checkout segue digitável) e um CEP inexistente
 * é resposta, não falha, então não vai à BrasilAPI.
 */
import { describe, expect, it, vi } from "vitest"

import { buscarCep, TIMEOUT_CEP_MS } from "../shipping-cep"

const PAULISTA = {
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  complemento: "de 612 a 1510 - lado par",
  bairro: "Bela Vista",
  localidade: "São Paulo",
  uf: "SP",
}

const PAULISTA_BRASILAPI = {
  cep: "01310100",
  state: "SP",
  city: "São Paulo",
  neighborhood: "Bela Vista",
  street: "Avenida Paulista",
}

/** Uma resposta como o `fetch` entrega. */
function resposta(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response
}

/** Um `fetch` que responde por URL, contando as chamadas. */
function dubleFetch(
  porUrl: Record<string, () => Response | Promise<Response>>
) {
  return vi.fn(async (url: string | URL | Request) => {
    const chave = String(url)
    const responde = Object.entries(porUrl).find(([pedaco]) =>
      chave.includes(pedaco)
    )?.[1]

    if (!responde) {
      throw new Error(`URL inesperada no teste: ${chave}`)
    }

    return responde()
  }) as unknown as typeof fetch
}

describe("buscarCep — o caminho feliz", () => {
  it("devolve rua, bairro, cidade e estado do ViaCEP", async () => {
    const fetchImpl = dubleFetch({ viacep: () => resposta(PAULISTA) })

    await expect(buscarCep("01310-100", { fetchImpl })).resolves.toEqual({
      encontrado: true,
      endereco: {
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
      },
    })
  })

  it("aceita o CEP com máscara, com espaço, ou só os números", async () => {
    for (const cep of ["01310-100", "01310 100", "01310100"]) {
      const fetchImpl = dubleFetch({ viacep: () => resposta(PAULISTA) })

      expect((await buscarCep(cep, { fetchImpl })).encontrado).toBe(true)
    }
  })

  it("pede o CEP só com dígitos, na URL do ViaCEP", async () => {
    const fetchImpl = dubleFetch({ viacep: () => resposta(PAULISTA) })

    await buscarCep("01310-100", { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/01310100/json/",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    )
  })
})

describe("buscarCep — CEP incompleto", () => {
  it("não sai pedido enquanto não há oito números", async () => {
    const fetchImpl = dubleFetch({})

    for (const cep of ["", "01310", "0131-0", null, undefined]) {
      await expect(buscarCep(cep, { fetchImpl })).resolves.toEqual({
        encontrado: false,
        motivo: "cep-incompleto",
      })
    }

    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe("buscarCep — a cascata", () => {
  it("vai à BrasilAPI quando o ViaCEP falha na rede", async () => {
    const fetchImpl = dubleFetch({
      viacep: () => {
        throw new TypeError("Failed to fetch")
      },
      brasilapi: () => resposta(PAULISTA_BRASILAPI),
    })

    await expect(buscarCep("01310100", { fetchImpl })).resolves.toEqual({
      encontrado: true,
      endereco: {
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("vai à BrasilAPI quando o ViaCEP devolve erro do servidor", async () => {
    const fetchImpl = dubleFetch({
      viacep: () => resposta({ message: "fora" }, 503),
      brasilapi: () => resposta(PAULISTA_BRASILAPI),
    })

    expect((await buscarCep("01310100", { fetchImpl })).encontrado).toBe(true)
  })

  it("NÃO vai à BrasilAPI quando o CEP não existe — é resposta, não falha", async () => {
    const fetchImpl = dubleFetch({ viacep: () => resposta({ erro: true }) })

    await expect(buscarCep("99999999", { fetchImpl })).resolves.toEqual({
      encontrado: false,
      motivo: "cep-inexistente",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("devolve 'provedor-fora' quando as duas caem — e não lança", async () => {
    const fetchImpl = dubleFetch({
      viacep: () => {
        throw new TypeError("Failed to fetch")
      },
      brasilapi: () => {
        throw new TypeError("Failed to fetch")
      },
    })

    await expect(buscarCep("01310100", { fetchImpl })).resolves.toEqual({
      encontrado: false,
      motivo: "provedor-fora",
    })
  })

  it("trata resposta em formato desconhecido como falha e tenta o próximo", async () => {
    const fetchImpl = dubleFetch({
      viacep: () => resposta("<html>manutenção</html>"),
      brasilapi: () => resposta(PAULISTA_BRASILAPI),
    })

    expect((await buscarCep("01310100", { fetchImpl })).encontrado).toBe(true)
  })

  it("trata o 404 da BrasilAPI como CEP inexistente", async () => {
    const fetchImpl = dubleFetch({
      viacep: () => {
        throw new TypeError("Failed to fetch")
      },
      brasilapi: () => resposta({ message: "not found" }, 404),
    })

    await expect(buscarCep("99999999", { fetchImpl })).resolves.toEqual({
      encontrado: false,
      motivo: "cep-inexistente",
    })
  })
})

describe("buscarCep — tolerância do dado parcial", () => {
  it("aceita o bairro vazio do ViaCEP sem inventar valor", async () => {
    const fetchImpl = dubleFetch({
      viacep: () =>
        resposta({ ...PAULISTA, logradouro: "", bairro: "", complemento: "" }),
    })

    await expect(buscarCep("01001000", { fetchImpl })).resolves.toEqual({
      encontrado: true,
      endereco: {
        logradouro: "",
        bairro: "",
        cidade: "São Paulo",
        estado: "SP",
      },
    })
  })
})

describe("buscarCep — o relógio", () => {
  it("desiste do provedor mudo no prazo, sem travar o campo", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // O provedor nunca responde: só o abort do prazo encerra a espera.
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          )
        })
    ) as unknown as typeof fetch

    const comecou = Date.now()
    const resultado = await buscarCep("01310100", {
      fetchImpl,
      timeoutMs: 20,
    })

    expect(resultado).toEqual({ encontrado: false, motivo: "provedor-fora" })
    expect(Date.now() - comecou).toBeLessThan(TIMEOUT_CEP_MS)
  })

  it("não começa o segundo provedor se quem chamou já desistiu", async () => {
    const fetchImpl = dubleFetch({})
    const controle = new AbortController()
    controle.abort()

    await buscarCep("01310100", { fetchImpl, signal: controle.signal })

    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
