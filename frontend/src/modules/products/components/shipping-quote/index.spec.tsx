/**
 * A caixa de frete e prazo: o que ela mostra, e quando ela não existe.
 * -------------------------------------------------------------------------
 * Este é o componente que substitui o campo de CEP da referência — aquele que
 * respondia "3 a 5 dias úteis, grátis" para qualquer CEP digitado. O contrato é o
 * inverso: **sem opção de entrega calculada, não há caixa**. É o que este teste
 * trava, junto com o desenho (as classes do `brand.css`) e o CEP só aparecendo na
 * frase quando ele está completo.
 *
 * O ícone do caminhão sai com `aria-hidden`: ele é do desenho, e a frase ao lado é
 * que informa.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import ShippingQuote from "."

const html = (props: Parameters<typeof ShippingQuote>[0]) =>
  renderToStaticMarkup(<ShippingQuote {...props} />)

/** As opções do jeito que o backend as devolve (o prazo é texto da loja). */
const opcoes = [
  { titulo: "Entrega padrão", prazo: "3 a 5 dias úteis", preco: 0, moeda: "brl" },
  { titulo: "Expressa", prazo: "1 a 2 dias úteis", preco: 24.9, moeda: "brl" },
]

const texto = (markup: string) => markup.replace(/\u00a0/g, " ")

describe("ShippingQuote", () => {
  it("desenha uma linha por modalidade, com o CEP consultado na frase", () => {
    const markup = texto(html({ cep: "01310100", opcoes }))

    expect(markup).toContain('class="rv-shipping-quote"')
    expect(markup).toContain("Frete e prazo")
    expect(markup).toContain("Opções de entrega para o CEP 01310-100")
    expect(markup).toContain("Entrega padrão · 3 a 5 dias úteis · Grátis")
    expect(markup).toContain("Expressa · 1 a 2 dias úteis · R$ 24,90")
  })

  it("cada modalidade é um item da lista, com a classe do resultado", () => {
    const markup = html({ cep: "01310100", opcoes })

    expect(markup).toContain('class="rv-shipping-quote-options"')
    expect(markup.split('class="rv-shipping-quote-result"').length - 1).toBe(2)
  })

  it("o CEP só entra na frase quando ele está completo", () => {
    // Um "0131-0" no meio da digitação não vira "Opções para o CEP 0131-0".
    const markup = html({ cep: "0131", opcoes })

    expect(markup).toContain("Opções de entrega disponíveis")
    expect(markup).not.toContain("0131")
  })

  it("sem CEP, a caixa ainda descreve a entrega que foi calculada", () => {
    expect(html({ opcoes })).toContain("Opções de entrega disponíveis")
  })

  it("sem opção calculada, não desenha nada — nem o campo, nem o convite", () => {
    expect(html({})).toBe("")
    expect(html({ cep: "01310100" })).toBe("")
    expect(html({ cep: "01310100", opcoes: [] })).toBe("")
  })

  it("modalidade sem título não vira linha vazia: só as válidas entram", () => {
    const markup = html({
      opcoes: [{ titulo: "   " }, ...opcoes],
    })

    expect(markup.split('class="rv-shipping-quote-result"').length - 1).toBe(2)
    expect(html({ opcoes: [{ titulo: "" }] })).toBe("")
  })

  it("o ícone do caminhão é decorativo", () => {
    expect(html({ opcoes })).toContain('aria-hidden="true"')
  })
})
