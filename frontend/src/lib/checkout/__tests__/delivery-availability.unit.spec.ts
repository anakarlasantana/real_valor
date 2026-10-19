/**
 * Falha ≠ vazio: `null` é `indisponivel`; `[]` é `sem-opcoes`. Era a diferença
 * que o `CheckoutForm` perdia ao devolver `null` para os dois.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
import { describe, expect, it } from "vitest"

import { classificarOpcoesDeEntrega } from "../delivery-availability"

describe("classificarOpcoesDeEntrega", () => {
  it("trata a falha da chamada como indisponível", () => {
    expect(classificarOpcoesDeEntrega(null)).toEqual({
      estado: "indisponivel",
    })
    expect(classificarOpcoesDeEntrega(undefined)).toEqual({
      estado: "indisponivel",
    })
  })

  it("trata a resposta vazia como sem opções — e não como falha", () => {
    expect(classificarOpcoesDeEntrega([])).toEqual({ estado: "sem-opcoes" })
  })

  it("devolve as opções quando existem", () => {
    const opcoes = [{ id: "so_pac" }, { id: "so_sedex" }]

    expect(classificarOpcoesDeEntrega(opcoes)).toEqual({
      estado: "ok",
      opcoes,
    })
  })

  it("não confunde lista vazia com lista ausente", () => {
    expect(classificarOpcoesDeEntrega([]).estado).not.toBe("indisponivel")
    expect(classificarOpcoesDeEntrega(null).estado).not.toBe("sem-opcoes")
  })
})
