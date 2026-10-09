/**
 * As parcelas e o Pix: as duas linhas, e o que acontece quando falta uma.
 * -------------------------------------------------------------------------
 * A conta das duas frases tem teste próprio em `lib/util/installments.spec.ts`;
 * o que se testa aqui é a **montagem**: o bloco com a classe do `brand.css`
 * (`.rv-installments`, que o bloco do preço e o resumo da sacola compartilham), o
 * Pix como `<b>` (é o que o CSS pinta de verde) e o comportamento de cada metade
 * que falta — uma linha continua aparecendo sozinha, as duas ausentes não
 * desenham nada.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import InstallmentInfo from "."

const html = (props: Parameters<typeof InstallmentInfo>[0]) =>
  renderToStaticMarkup(<InstallmentInfo {...props} />)

/** O `·` e o "R$" vêm do `Intl`, com espaço inquebrável. */
const texto = (markup: string) => markup.replace(/\u00a0/g, " ")

describe("InstallmentInfo", () => {
  it("desenha as parcelas e o Pix, com o verde no `<b>`", () => {
    const markup = texto(
      html({
        installments: { count: 6, amount: 12490, interestFree: true },
        pix: 464.55,
        moeda: "brl",
      })
    )

    expect(markup).toContain('class="rv-installments"')
    expect(markup).toContain("<span>6x de R$ 124,90 sem juros</span>")
    expect(markup).toContain("<b>R$ 464,55 no Pix</b>")
  })

  it("só as parcelas: o bloco aparece sem a linha do Pix", () => {
    const markup = texto(
      html({
        installments: { count: 3, amount: 8300, interestFree: false },
        moeda: "brl",
      })
    )

    expect(markup).toContain("3x de R$ 83,00 com juros")
    expect(markup).not.toContain("<b>")
  })

  it("só o Pix: o bloco aparece sem o parcelamento", () => {
    const markup = texto(html({ pix: 464.55, moeda: "brl" }))

    expect(markup).toContain("<b>R$ 464,55 no Pix</b>")
    expect(markup).not.toContain("<span>")
  })

  it("sem nenhum dos dois números, não desenha nada", () => {
    expect(html({})).toBe("")
    expect(html({ installments: null, pix: null, moeda: "brl" })).toBe("")
  })

  it("sem moeda não há linha — nem com os dois números no lugar", () => {
    // A montagem passa a moeda do preço; este é o caso em que ela falta, e o
    // `convertToLocale` devolveria "12490 no Pix".
    expect(
      html({
        installments: { count: 6, amount: 12490, interestFree: true },
        pix: 464.55,
      })
    ).toBe("")
  })
})
