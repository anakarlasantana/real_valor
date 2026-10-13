/**
 * As parcelas e o Pix, em uma linha.
 * -------------------------------------------------------------------------
 * O que este teste protege:
 *
 *   - **a unidade de cada número**, que é a armadilha deste par de funções: o
 *     parcelamento chega **em centavos** (é o que o contrato diz) e o valor do Pix
 *     chega **em reais** (é o preço da tela). Trocar os dois é a parcela de
 *     R$ 12.490,00 escrita abaixo do preço;
 *   - **as recusas que evitam promessa**: uma parcela só ("1x"), um valor zerado,
 *     uma contagem fracionada e a moeda ausente (o `convertToLocale` devolveria o
 *     número cru — "6x de 12490") não viram linha;
 *   - **o "sem juros"**, que só é escrito quando o provedor confirma. Quando ele
 *     não confirma, a linha diz "com juros" — e não fica em silêncio sobre a taxa.
 */
import { describe, expect, it } from "vitest"

import { linhaDasParcelas, linhaDoPix } from "./installments"

/**
 * O texto sem o espaço inquebrável do `Intl`.
 *
 * `Intl.NumberFormat` escreve "R$" + `U+00A0` + "124,90", e o `·` do rótulo é o do
 * resto da loja. Comparar a string inteira é o que pega um "R$ 124,90" quebrado em
 * duas moedas, e para isso o espaço precisa ser o comum — um teste que só funcionasse
 * com o caractere invisível seria um teste que ninguém consegue ler depois.
 */
const texto = (linha: string | null) => linha?.replace(/\u00a0/g, " ") ?? null

describe("linhaDasParcelas — em centavos, como o contrato manda", () => {
  it("escreve a parcela sem juros: valor, contagem e a promessa do provedor", () => {
    // `amount: 12490` são **centavos** — R$ 124,90.
    expect(
      texto(
        linhaDasParcelas(
          { count: 6, amount: 12490, interestFree: true },
          "brl"
        )
      )
    ).toBe("6x de R$ 124,90 sem juros")
  })

  it("quando o provedor não confirma juros zero, a linha avisa", () => {
    expect(
      texto(
        linhaDasParcelas(
          { count: 3, amount: 8300, interestFree: false },
          "brl"
        )
      )
    ).toBe("3x de R$ 83,00 com juros")
  })

  it("uma parcela não é parcelamento", () => {
    expect(
      linhaDasParcelas({ count: 1, amount: 24990, interestFree: true }, "brl")
    ).toBeNull()
  })

  it("contagem que não é inteiro positivo de verdade não vira linha", () => {
    expect(
      linhaDasParcelas({ count: 0, amount: 24990, interestFree: true }, "brl")
    ).toBeNull()
    expect(
      linhaDasParcelas({ count: 2.5, amount: 12490, interestFree: true }, "brl")
    ).toBeNull()
    expect(
      linhaDasParcelas({ count: -6, amount: 12490, interestFree: true }, "brl")
    ).toBeNull()
  })

  it("sem valor de parcela, sem linha", () => {
    expect(
      linhaDasParcelas({ count: 6, amount: 0, interestFree: true }, "brl")
    ).toBeNull()
    expect(
      linhaDasParcelas({ count: 6, amount: NaN, interestFree: true }, "brl")
    ).toBeNull()
  })

  it("sem moeda não há preço: o número cru seria pior que a linha não existir", () => {
    expect(
      linhaDasParcelas({ count: 6, amount: 12490, interestFree: true }, "")
    ).toBeNull()
    expect(
      linhaDasParcelas({ count: 6, amount: 12490, interestFree: true }, null)
    ).toBeNull()
  })

  it("sem resposta do provedor, não há parcelamento a mostrar", () => {
    expect(linhaDasParcelas(null, "brl")).toBeNull()
    expect(linhaDasParcelas(undefined, "brl")).toBeNull()
  })
})

describe("linhaDoPix — em reais, como o preço da tela", () => {
  it("escreve o valor e a condição", () => {
    expect(texto(linhaDoPix(464.55, "brl"))).toBe("R$ 464,55 no Pix")
  })

  it("preço zerado é um valor legítimo (a peça de brinde da loja)", () => {
    expect(texto(linhaDoPix(0, "brl"))).toBe("R$ 0,00 no Pix")
  })

  it("sem valor ou sem moeda, não há linha", () => {
    expect(linhaDoPix(null, "brl")).toBeNull()
    expect(linhaDoPix(undefined, "brl")).toBeNull()
    expect(linhaDoPix(464.55, null)).toBeNull()
    expect(linhaDoPix(464.55, "")).toBeNull()
  })

  it("valor negativo ou não numérico não é preço", () => {
    expect(linhaDoPix(-1, "brl")).toBeNull()
    expect(linhaDoPix(NaN, "brl")).toBeNull()
    expect(linhaDoPix(Infinity, "brl")).toBeNull()
  })
})
