import { describe, expect, it } from "vitest"

import {
  CALCULANDO,
  CEP_INVALIDO,
  SEM_OPCAO,
  cepDoCheckout,
  estadoAoConsultar,
  estadoDaResposta,
  mensagemDoEstado,
} from "../cep-frete"

const opcao = {
  titulo: "PAC",
  prazo: "até 5 dias úteis",
  preco: 19.9,
  moeda: "brl",
}

describe("estadoAoConsultar", () => {
  it("CEP vazio ou curto é inválido, e não vira requisição", () => {
    expect(estadoAoConsultar("")).toEqual({ fase: "invalido" })
    expect(estadoAoConsultar("0131")).toEqual({ fase: "invalido" })
    expect(estadoAoConsultar(null)).toEqual({ fase: "invalido" })
  })

  it("oito dígitos entram em carregando com o CEP normalizado", () => {
    expect(estadoAoConsultar("01310100")).toEqual({
      fase: "carregando",
      cep: "01310100",
    })
    expect(estadoAoConsultar("01310-100")).toEqual({
      fase: "carregando",
      cep: "01310100",
    })
  })
})

describe("estadoDaResposta", () => {
  it("com opções, o estado é ok e carrega o CEP consultado", () => {
    expect(estadoDaResposta({ ok: true, opcoes: [opcao] }, "01310100")).toEqual({
      fase: "ok",
      cep: "01310100",
      opcoes: [opcao],
    })
  })

  it("sem opções é 'sem-opcao', e não erro", () => {
    expect(estadoDaResposta({ ok: true, opcoes: [] }, "01310100")).toEqual({
      fase: "sem-opcao",
      cep: "01310100",
    })
  })

  it("falha vira erro com a mensagem recebida", () => {
    expect(
      estadoDaResposta({ ok: false, mensagem: "provedor fora" }, "01310100")
    ).toEqual({ fase: "erro", mensagem: "provedor fora" })
  })
})

describe("mensagemDoEstado", () => {
  it("cada fase tem a sua mensagem, e o resultado não tem nenhuma", () => {
    expect(mensagemDoEstado({ fase: "invalido" })).toBe(CEP_INVALIDO)
    expect(mensagemDoEstado({ fase: "carregando", cep: "01310100" })).toBe(
      CALCULANDO
    )
    expect(mensagemDoEstado({ fase: "sem-opcao", cep: "01310100" })).toBe(
      SEM_OPCAO
    )
    expect(mensagemDoEstado({ fase: "erro", mensagem: "provedor fora" })).toBe(
      "provedor fora"
    )
    expect(
      mensagemDoEstado({ fase: "ok", cep: "01310100", opcoes: [opcao] })
    ).toBeNull()
    expect(mensagemDoEstado({ fase: "vazio" })).toBeNull()
  })
})

describe("cepDoCheckout", () => {
  it("usa o CEP do carrinho quando ele está completo", () => {
    expect(cepDoCheckout("60352-680", "01310100")).toBe("60352680")
  })

  it("sem CEP no carrinho, herda o que a cliente digitou na peça", () => {
    expect(cepDoCheckout("", "01310100")).toBe("01310100")
    expect(cepDoCheckout(null, "01310-100")).toBe("01310100")
  })

  it("sem os dois, o campo nasce vazio em vez de meio preenchido", () => {
    expect(cepDoCheckout("0131", "")).toBe("")
    expect(cepDoCheckout(undefined, undefined)).toBe("")
  })
})
