/**
 * O CEP, e as opções de entrega em uma linha.
 * -------------------------------------------------------------------------
 * O que este teste protege:
 *
 *   - **as formas do CEP que a cliente escreve** — "01310100", "01310-100" e
 *     "01310 100" são o mesmo endereço. Recusar as duas últimas seria pedir que ela
 *     traduzisse o próprio CEP;
 *   - **o corte em oito dígitos**, que descarta o número do imóvel colado junto e
 *     evita um "01310100999" virar consulta;
 *   - **"ainda não dá" ≠ "já dá"**: `formatarCep` devolve `null` enquanto o CEP não
 *     estiver completo, porque um "0131-0" no meio da digitação é pior que nada;
 *   - **a linha da modalidade**, com as três partes opcionais: preço zerado é
 *     "Grátis" (é como a loja fala) e preço sem moeda é omitido (o
 *     `convertToLocale` devolveria o número cru).
 */
import { describe, expect, it } from "vitest"

import {
  CEP_DIGITOS,
  cepValido,
  descreverOpcao,
  formatarCep,
  normalizarCep,
  type OpcaoDeEntrega,
} from "./shipping-quote"

/** O texto sem o espaço inquebrável do `Intl` (ver `installments.spec.ts`). */
const texto = (linha: string | null) => linha?.replace(/\u00a0/g, " ") ?? null

describe("normalizarCep — as formas do mesmo endereço", () => {
  it("aceita o CEP com hífen, com espaço ou só dígitos", () => {
    expect(normalizarCep("01310-100")).toBe("01310100")
    expect(normalizarCep("01310 100")).toBe("01310100")
    expect(normalizarCep("01310100")).toBe("01310100")
  })

  it("descarta o que vier colado depois dos oito dígitos", () => {
    expect(normalizarCep("01310100999")).toBe("01310100")
    expect(normalizarCep("01310-100, apto 91")).toBe("01310100")
  })

  it("o que não é texto não vira CEP", () => {
    expect(normalizarCep(null)).toBe("")
    expect(normalizarCep(undefined)).toBe("")
    expect(normalizarCep("abc")).toBe("")
  })
})

describe("cepValido — a régua é oito dígitos", () => {
  it("oito dígitos é CEP completo", () => {
    expect(cepValido("01310-100")).toBe(true)
    expect(CEP_DIGITOS).toBe(8)
  })

  it("faltando ou sobrando dígito, ainda não é CEP", () => {
    expect(cepValido("0131010")).toBe(false)
    expect(cepValido("")).toBe(false)
    expect(cepValido("  ")).toBe(false)
  })
})

describe("formatarCep — a escrita brasileira", () => {
  it("escreve o hífen no lugar certo", () => {
    expect(formatarCep("01310100")).toBe("01310-100")
    expect(formatarCep("01310 100")).toBe("01310-100")
  })

  it("CEP incompleto não é formatado — e não vira frase pela metade", () => {
    expect(formatarCep("0131")).toBeNull()
    expect(formatarCep(null)).toBeNull()
    expect(formatarCep("")).toBeNull()
  })
})

describe("descreverOpcao — a linha da modalidade", () => {
  const base: OpcaoDeEntrega = {
    titulo: "Entrega padrão",
    prazo: "3 a 5 dias úteis",
    preco: 0,
    moeda: "brl",
  }

  it("escreve as três partes, com o separador da loja", () => {
    expect(descreverOpcao(base)).toBe(
      "Entrega padrão · 3 a 5 dias úteis · Grátis"
    )
  })

  it("frete pago mostra o preço, no formato da loja", () => {
    expect(texto(descreverOpcao({ ...base, preco: 24.9 }))).toBe(
      "Entrega padrão · 3 a 5 dias úteis · R$ 24,90"
    )
  })

  it("modalidade sem prazo não fica com separador solto", () => {
    expect(texto(descreverOpcao({ ...base, prazo: null }))).toBe(
      "Entrega padrão · Grátis"
    )
    expect(descreverOpcao({ ...base, prazo: "   " })).toBe(
      "Entrega padrão · Grátis"
    )
  })

  it("modalidade que não fala de preço (a retirada) fica só com o título", () => {
    expect(descreverOpcao({ titulo: "Retirar na loja", prazo: null, preco: null })).toBe(
      "Retirar na loja"
    )
  })

  it("preço zerado é \"Grátis\" mesmo sem a moeda — zero não é valor monetário", () => {
    expect(descreverOpcao({ ...base, moeda: null })).toBe(
      "Entrega padrão · 3 a 5 dias úteis · Grátis"
    )
  })

  it("preço sem moeda é omitido: o número cru não é preço", () => {
    expect(descreverOpcao({ ...base, preco: 24.9, moeda: null })).toBe(
      "Entrega padrão · 3 a 5 dias úteis"
    )
  })

  it("preço negativo ou não numérico também não entra na linha", () => {
    expect(descreverOpcao({ ...base, preco: -10 })).toBe(
      "Entrega padrão · 3 a 5 dias úteis"
    )
    expect(descreverOpcao({ ...base, preco: NaN })).toBe(
      "Entrega padrão · 3 a 5 dias úteis"
    )
  })

  it("sem título não há linha: ela começaria com o separador", () => {
    expect(descreverOpcao({ ...base, titulo: "  " })).toBeNull()
    expect(descreverOpcao({ ...base, titulo: "" })).toBeNull()
  })
})
