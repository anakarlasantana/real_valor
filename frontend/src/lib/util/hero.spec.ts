/**
 * Os slides da capa.
 * -------------------------------------------------------------------------
 * O que este teste protege é a **capa que não muda** e o carrossel que não
 * aparece vazio:
 *
 *   - base antiga (sem `slides`) tem de continuar desenhando a capa única, com
 *     a foto e o texto dos campos de sempre — é o que faz o recurso não ter
 *     migração;
 *   - lista com uma linha vazia (o rastro do editor) não pode virar slide: uma
 *     tela preta no meio do carrossel é o defeito;
 *   - depois do filtro, sobrar um slide é uma capa, não um carrossel de um.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import { heroSlides } from "./hero"

const legacy = {
  imageUrl: "/brand/hero.jpg",
  imageAlt: "Alfaiataria feminina Real Valor",
  eyebrow: "Nova coleção",
  headline: "Você não precisa ser rica para se",
  headlineEmphasis: "sentir elegante.",
  subtitle: "Alfaiataria para todas.",
  ctaLabel: "Conheça a coleção",
  ctaHref: "/store",
}

describe("heroSlides — sem lista, a capa de sempre", () => {
  it("devolve a capa única com os campos da seção", () => {
    const slides = heroSlides(legacy)

    expect(slides).toHaveLength(1)
    expect(slides[0].headline).toBe("Você não precisa ser rica para se")
    expect(slides[0].headlineEmphasis).toBe("sentir elegante.")
    expect(slides[0].ctaHref).toBe("/store")
  })

  it("lista vazia é o mesmo que lista ausente", () => {
    expect(heroSlides({ ...legacy, slides: [] })).toHaveLength(1)
  })

  it("lista que não é lista é ignorada (o `data` é texto livre)", () => {
    expect(heroSlides({ ...legacy, slides: "dois slides" })).toHaveLength(1)
  })

  it("seção sem nada não é um slide (a capa não é desenhada)", () => {
    expect(heroSlides({})).toEqual([])
  })
})

describe("heroSlides — com lista, a lista manda", () => {
  it("os slides da lista substituem a capa, na ordem", () => {
    const slides = heroSlides({
      ...legacy,
      slides: [
        { headline: "Primeiro", imageUrl: "/brand/1.jpg" },
        { headline: "Segundo", imageUrl: "/brand/2.jpg" },
      ],
    })

    expect(slides.map((slide) => slide.headline)).toEqual([
      "Primeiro",
      "Segundo",
    ])
  })

  it("slide vazio cai fora (linha recém-criada no CRM)", () => {
    const slides = heroSlides({
      slides: [
        { headline: "Vale" },
        {},
        { imageUrl: "   " },
        { imageUrl: "/brand/2.jpg" },
      ],
    })

    expect(slides).toHaveLength(2)
    expect(slides[0].headline).toBe("Vale")
    expect(slides[1].imageUrl).toBe("/brand/2.jpg")
  })

  it("espaço sobrando não conta como conteúdo", () => {
    expect(heroSlides({ slides: [{ headline: "   " }, { imageUrl: "  " }] })).toEqual(
      []
    )
  })

  it("sobra um slide depois do filtro: é capa, não carrossel", () => {
    const slides = heroSlides({ slides: [{ headline: "Único" }, {}] })

    expect(slides).toHaveLength(1)
    expect(slides[0].headline).toBe("Único")
  })

  it("todos os campos viram texto, e o que não é texto vira vazio", () => {
    const slides = heroSlides({
      slides: [{ headline: "  Com espaço  ", ctaHref: 42, imageAlt: null }],
    })

    expect(slides[0].headline).toBe("Com espaço")
    expect(slides[0].ctaHref).toBe("")
    expect(slides[0].imageAlt).toBe("")
  })
})
