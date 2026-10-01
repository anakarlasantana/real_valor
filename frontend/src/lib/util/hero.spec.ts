/**
 * Os slides da capa.
 * -------------------------------------------------------------------------
 * A capa **é** a lista `slides` da seção. O que este teste protege é o que dá
 * errado em silêncio:
 *
 *   - lista vazia (ou `data` sem lista) não é capa: a seção some da página, e
 *     não vira uma faixa vazia;
 *   - linha vazia (o rastro do editor) não pode virar slide: uma tela preta no
 *     meio do carrossel é o defeito;
 *   - depois do filtro, sobrar um slide é uma capa **estática**, não um
 *     carrossel de um;
 *   - os campos da **própria seção** (`headline`, `imageUrl`…) não são lidos: a
 *     capa tem uma forma só desde a v9, e um `data` antigo que ainda os tenha —
 *     toda base gravada antes disso — não pode reabrir a segunda forma.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import { heroSlides } from "./hero"

const slide = {
  imageUrl: "/brand/hero.jpg",
  imageAlt: "Alfaiataria feminina Real Valor",
  eyebrow: "Nova coleção",
  headline: "Você não precisa ser rica para se",
  headlineEmphasis: "sentir elegante.",
  subtitle: "Alfaiataria para todas.",
  ctaLabel: "Conheça a coleção",
  ctaHref: "/store",
}

describe("heroSlides — a capa é a lista", () => {
  it("devolve o slide da lista, com os campos dele", () => {
    const slides = heroSlides({ slides: [slide] })

    expect(slides).toHaveLength(1)
    expect(slides[0].headline).toBe("Você não precisa ser rica para se")
    expect(slides[0].headlineEmphasis).toBe("sentir elegante.")
    expect(slides[0].ctaHref).toBe("/store")
  })

  it("os slides saem na ordem da lista", () => {
    const slides = heroSlides({
      slides: [
        { headline: "Primeiro", imageUrl: "/brand/1.jpg" },
        { headline: "Segundo", imageUrl: "/brand/2.jpg" },
      ],
    })

    expect(slides.map((item) => item.headline)).toEqual([
      "Primeiro",
      "Segundo",
    ])
  })

  it("lista vazia não é capa (a seção não é desenhada)", () => {
    expect(heroSlides({ slides: [] })).toEqual([])
  })

  it("seção sem lista não é capa, mesmo com os campos antigos no `data`", () => {
    // O `data` de uma base gravada antes da v9 ainda traz a cópia no topo da
    // seção. Desde que a lista virou a única forma da capa, ela não é lida — e o
    // cast é justamente o que prova isso: a forma antiga **não** é aceita como
    // fonte dos slides.
    const antiga = slide as unknown as { slides?: unknown }

    expect(heroSlides(antiga)).toEqual([])
  })

  it("lista que não é lista é ignorada (o `data` é texto livre)", () => {
    expect(heroSlides({ slides: "dois slides" })).toEqual([])
  })
})

describe("heroSlides — o carrossel não aparece vazio", () => {
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
    expect(
      heroSlides({ slides: [{ headline: "   " }, { imageUrl: "  " }] })
    ).toEqual([])
  })

  it("sobra um slide depois do filtro: é capa estática, não carrossel", () => {
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
