/**
 * O provider do Resend: o corpo (template + variáveis, sem assunto nem HTML),
 * os erros (422, 429, timeout, rede) e o `validateOptions`.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
import { MedusaError } from "@medusajs/framework/utils"

import {
  ResendNotificationService,
  type OpcoesDoResend,
} from "../resend/service"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any

function servico(opcoes: Partial<OpcoesDoResend> = {}) {
  return new ResendNotificationService(
    { logger },
    {
      apiKey: "re_teste",
      from: "Real Valor <nao-responda@realvalor.com.br>",
      baseUrl: "https://api.resend.test",
      ...opcoes,
    }
  )
}

function resposta(corpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(corpo),
  } as Response
}

const pedido = {
  to: "ana@exemplo.com",
  channel: "email",
  template: "pedido-confirmado",
  data: { NOME: "Ana", PEDIDO: "1042" },
}

let fetchMock: jest.SpyInstance

beforeEach(() => {
  fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(resposta({ id: "email_123" }))
})

afterEach(() => {
  fetchMock.mockRestore()
})

describe("ResendNotificationService.send", () => {
  it("manda o alias do template e as variáveis, sem assunto nem HTML", async () => {
    const resultado = await servico().send(pedido)

    expect(resultado).toEqual({ id: "email_123" })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(String(init?.body))

    expect(url).toBe("https://api.resend.test/emails")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_teste",
      "Content-Type": "application/json",
    })
    expect(corpo).toEqual({
      from: "Real Valor <nao-responda@realvalor.com.br>",
      to: ["ana@exemplo.com"],
      template: {
        id: "pedido-confirmado",
        variables: { NOME: "Ana", PEDIDO: "1042" },
      },
    })
    expect(corpo).not.toHaveProperty("subject")
    expect(corpo).not.toHaveProperty("html")
    expect(corpo).not.toHaveProperty("text")
  })

  it("envia variável nula como string vazia e converte o resto em texto", async () => {
    await servico().send({
      ...pedido,
      data: { RASTREIO: null, QUANTIDADE: 3, FRAGIL: true, EXTRA: { a: 1 } },
    })

    const corpo = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))

    expect(corpo.template.variables).toEqual({
      RASTREIO: "",
      QUANTIDADE: 3,
      FRAGIL: true,
      EXTRA: "[object Object]",
    })
  })

  it("deixa o pedido sobrescrever o remetente pelo provider_data", async () => {
    await servico().send({
      ...pedido,
      provider_data: { from: "Ateliê <pedidos@realvalor.com.br>" },
    })

    const corpo = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(corpo.from).toBe("Ateliê <pedidos@realvalor.com.br>")
  })

  it("recusa sem destinatário, sem chamar o Resend", async () => {
    await expect(servico().send({ ...pedido, to: " " })).rejects.toThrow(
      MedusaError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("recusa sem template, sem chamar o Resend", async () => {
    await expect(servico().send({ ...pedido, template: "" })).rejects.toThrow(
      MedusaError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("traduz o 422 do template não publicado", async () => {
    fetchMock.mockResolvedValue(
      resposta({ message: "Template not found", statusCode: 422 }, 422)
    )

    await expect(servico().send(pedido)).rejects.toThrow(
      /HTTP 422.*Template not found/
    )
  })

  it("explica o 429 como teto diário do plano gratuito", async () => {
    fetchMock.mockResolvedValue(
      resposta({ message: "Too many requests", statusCode: 429 }, 429)
    )

    await expect(servico().send(pedido)).rejects.toThrow(/100 por dia/)
  })

  it("recusa uma resposta 200 sem id", async () => {
    fetchMock.mockResolvedValue(resposta({}))

    await expect(servico().send(pedido)).rejects.toThrow(/não devolveu o id/)
  })

  it("traduz o timeout em vez de pendurar o worker", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    )

    await expect(servico({ timeoutMs: 1000 }).send(pedido)).rejects.toThrow(
      /não respondeu em 1s/
    )
  })

  it("traduz a falha de rede", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))

    await expect(servico().send(pedido)).rejects.toThrow(
      /Não foi possível falar com o Resend: ECONNREFUSED/
    )
  })
})

describe("ResendNotificationService.validateOptions", () => {
  it("exige a API key", () => {
    expect(() =>
      ResendNotificationService.validateOptions({
        from: "Real Valor <nao-responda@realvalor.com.br>",
      })
    ).toThrow(/RESEND_API_KEY/)
  })

  it("exige o remetente", () => {
    expect(() =>
      ResendNotificationService.validateOptions({ apiKey: "re_teste" })
    ).toThrow(/RESEND_FROM/)
  })

  it("aceita a configuração completa", () => {
    expect(() =>
      ResendNotificationService.validateOptions({
        apiKey: "re_teste",
        from: "Real Valor <nao-responda@realvalor.com.br>",
        channels: ["email"],
      })
    ).not.toThrow()
  })
})
