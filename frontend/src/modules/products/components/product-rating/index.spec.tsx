/**
 * O bloco de avaliação da peça: o que ele desenha — e o silêncio.
 * -------------------------------------------------------------------------
 * Aqui se testa a montagem, que é o que este lote entrega: as classes do
 * `brand.css` (`rv-rating*`), as cinco estrelas, o texto em pt-BR — e o principal,
 * que só o render mostra: **sem dado, a saída é uma string vazia**, e não um bloco
 * vazio ocupando o lugar acima do título. A régua do que conta como avaliação tem
 * teste próprio em `lib/util/product-rating.spec.ts`; aqui ela é só o gatilho.
 *
 * Renderiza com `renderToStaticMarkup` porque o componente é **de servidor**: ele
 * não tem estado, efeito nem evento — e é isso que permite exercitá-lo em `node`,
 * sem DOM e sem biblioteca de render.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import ProductRating from "."

/** A montagem, com as props do contrato. */
const html = (props: Parameters<typeof ProductRating>[0]) =>
  renderToStaticMarkup(<ProductRating {...props} />)

/** Quantas estrelas cheias o markup tem (a vazia carrega a segunda classe). */
const cheias = (markup: string) =>
  markup.split('class="rv-rating-star"').length - 1

const vazias = (markup: string) =>
  markup.split("rv-rating-star-vazia").length - 1

describe("ProductRating", () => {
  it("desenha as estrelas, a nota e a contagem", () => {
    const markup = html({ media: 4.9, total: 28 })

    expect(markup).toContain('class="rv-rating"')
    expect(markup).toContain('class="rv-rating-count"')
    expect(markup).toContain("4,9 · 28 avaliações")
  })

  it("cinco estrelas sempre, e as cheias são as da nota arredondada", () => {
    const cinco = html({ media: 4.9, total: 28 })

    expect(cheias(cinco)).toBe(5)
    expect(vazias(cinco)).toBe(0)

    const tres = html({ media: 3.4, total: 12 })

    expect(cheias(tres)).toBe(3)
    expect(vazias(tres)).toBe(2)
  })

  it("as estrelas são decorativas: quem ouve a página lê o texto", () => {
    // Cinco glifos anunciados um a um seriam ruído; o `aria-hidden` do grupo é o
    // que deixa a contagem como a única informação falada.
    const markup = html({ media: 4.9, total: 28 })

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('data-testid="product-rating-count"')
  })

  it("sem os dois dados, não desenha nada (o bloco nasce desligado)", () => {
    expect(html({})).toBe("")
    expect(html({ media: 4.9 })).toBe("")
    expect(html({ media: null, total: null })).toBe("")
  })

  it("nota fora de 0–5 não vira estrelas inventadas", () => {
    expect(html({ media: 7, total: 3 })).toBe("")
    expect(html({ media: 0, total: 3 })).toBe("")
  })
})
