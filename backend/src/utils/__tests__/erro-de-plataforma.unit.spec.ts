/**
 * O erro de plataforma terceira, provado sem rede.
 *
 * O caso que motivou tudo: o 401 do SuperFrete, que perdia o motivo.
 */
import {
  classificarFalha,
  codigoDoStatus,
  lerDetalhe,
  mensagemDe,
  STATUS_SEM_RESPOSTA,
  STATUS_TEMPO,
} from "../erro-de-plataforma"
import { REDIGIDO, semPii } from "../redigir"

describe("lerDetalhe", () => {
  it.each([
    ["message do SuperFrete", { message: "Token inválida!" }, "Token inválida!"],
    ["message do Resend", { statusCode: 422, message: "Invalid `to`" }, "Invalid `to`"],
    ["error em string", { error: "invalid_token" }, "invalid_token"],
    ["error aninhado", { error: { message: "expired" } }, "expired"],
    ["details em lista", { details: ["from é obrigatório"] }, "details: from é obrigatório"],
    ["errors[] com message", { errors: [{ message: "cpf inválido" }] }, "cpf inválido"],
  ])("lê %s", (_nome, corpo, esperado) => {
    expect(lerDetalhe(corpo)).toBe(esperado)
  })

  it("lê o 400 de validação por campo da calculadora", () => {
    expect(lerDetalhe({ from: ["cep inválido"] })).toBe("from: cep inválido")
  })

  it("não inventa motivo onde não há", () => {
    expect(lerDetalhe({})).toBeUndefined()
    expect(lerDetalhe({ id: 12 })).toBeUndefined()
    expect(lerDetalhe({ message: "   " })).toBeUndefined()
    expect(lerDetalhe(undefined)).toBeUndefined()
    expect(lerDetalhe("")).toBeUndefined()
  })

  it("não segue um `message` vazio para dentro de um objeto qualquer", () => {
    // Um `data` que tem `message` não é o recado da plataforma.
    expect(lerDetalhe({ id: 12, data: { message: "xyz" } })).toBeUndefined()
  })
})

describe("mensagemDe", () => {
  it("põe o motivo da plataforma À FRENTE do texto genérico, no 401", () => {
    const texto = mensagemDe({
      plataforma: "SuperFrete",
      status: 401,
      detalhe: "Token inválida!",
      dica: "Gere o token de aplicação.",
    })

    expect(texto).toBe(
      "Token inválida! — o SuperFrete recusou a credencial. Gere o token de aplicação."
    )
    expect(texto.indexOf("Token inválida!")).toBeLessThan(
      texto.indexOf("recusou a credencial")
    )
  })

  it("o genérico é o fallback quando o provedor não diz por quê", () => {
    const texto = mensagemDe({
      plataforma: "Mercado Pago",
      status: 400,
      detalhe: "Invalid payment_method_id",
    })

    expect(texto).toBe(
      "Invalid payment_method_id — o Mercado Pago recusou os dados."
    )
    expect(mensagemDe({ plataforma: "Mercado Pago", status: 400 })).toBe(
      "o Mercado Pago recusou os dados."
    )
  })

  it("põe o motivo à frente no limite e no 5xx sem resposta também", () => {
    expect(
      mensagemDe({ plataforma: "Resend", status: 429, detalhe: "rate limit" })
    ).toBe(
      "rate limit — o Resend recusou por limite de chamadas; tente de novo em instantes."
    )
    expect(
      mensagemDe({ plataforma: "Resend", status: STATUS_SEM_RESPOSTA, detalhe: "ECONNREFUSED" })
    ).toBe("ECONNREFUSED — não foi possível falar com o Resend.")
  })

  it("NÃO manda conferir o ambiente quando a credencial é recusada", () => {
    const texto = mensagemDe({ plataforma: "SuperFrete", status: 401 })

    expect(texto).not.toContain("SUPERFRETE_AMBIENTE")
  })

  it.each([
    [400, "recusou os dados"],
    [422, "recusou os dados"],
    [404, "não encontrou o recurso"],
    [429, "limite de chamadas"],
  ])("classifica %i", (status, trecho) => {
    expect(mensagemDe({ plataforma: "Mercado Pago", status })).toContain(trecho)
  })

  it("distingue 5xx da plataforma de timeout e de ausência de resposta", () => {
    expect(mensagemDe({ plataforma: "Resend", status: 500 })).toContain("HTTP 500")
    expect(
      mensagemDe({ plataforma: "Resend", status: STATUS_TEMPO, limiteSegundos: 10 })
    ).toContain("não respondeu em 10s")
    expect(
      mensagemDe({ plataforma: "Resend", status: STATUS_SEM_RESPOSTA })
    ).toBe("não foi possível falar com o Resend.")
  })

  it("não deixa sobrar parêntese vazio quando não há detalhe", () => {
    expect(mensagemDe({ plataforma: "Resend", status: 401 })).toBe(
      "o Resend recusou a credencial."
    )
  })
})

describe("codigoDoStatus", () => {
  it("401 e 403 são a mesma coisa: credencial", () => {
    expect(codigoDoStatus(401)).toBe("CREDENCIAL")
    expect(codigoDoStatus(403)).toBe("CREDENCIAL")
  })
})

describe("classificarFalha", () => {
  it("o 401 do SuperFrete chega inteiro — mensagem, código e detalhe", () => {
    const falha = classificarFalha({
      plataforma: "SuperFrete",
      operacao: "POST /api/v0/calculator",
      status: 401,
      corpo: { message: "Token inválida!" },
      dica: "Gere o token de aplicação.",
    })

    expect(falha).toBeInstanceOf(Error)
    expect(falha.status).toBe(401)
    expect(falha.codigo).toBe("CREDENCIAL")
    expect(falha.operacao).toBe("POST /api/v0/calculator")
    expect(falha.detalhe).toEqual({ message: "Token inválida!" })
    expect(falha.message).toBe(
      "Token inválida! — o SuperFrete recusou a credencial. Gere o token de aplicação."
    )
  })

  it("redige o corpo — o erro do SuperFrete ecoa o destinatário", () => {
    const falha = classificarFalha({
      plataforma: "SuperFrete",
      operacao: "POST /api/v0/cart",
      status: 400,
      corpo: {
        message: "dados inválidos",
        to: { name: "Maria Silva", cpf: "12345678909", email: "maria@ex.com" },
      },
    })

    const texto = JSON.stringify(falha.detalhe)

    expect(texto).not.toContain("Maria")
    expect(texto).not.toContain("maria@ex.com")
    expect(texto).toContain(REDIGIDO)
  })

  it("não guarda o HTML de um proxy como detalhe", () => {
    const falha = classificarFalha({
      plataforma: "Mercado Pago",
      operacao: "POST /v1/preferences",
      status: 502,
      textoCru: "<html><body>502 Bad Gateway</body></html>",
    })

    expect(falha.detalhe).toBeUndefined()
    expect(falha.message).toContain("não-JSON")
    expect(falha.message).toContain("bytes")
    expect(falha.message).not.toContain("<html>")
  })
})

describe("semPii (compartilhado)", () => {
  it("continua valendo pelo reexport do Mercado Pago", () => {
    expect(semPii({ payer: { email: "a@b.com" } })).toEqual({
      payer: { email: REDIGIDO },
    })
  })
})
