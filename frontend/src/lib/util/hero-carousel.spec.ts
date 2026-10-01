/**
 * O rodízio da capa carrossel.
 * -------------------------------------------------------------------------
 * O que este teste protege é o que, errado, aparece na **primeira dobra** de
 * quem entra no site (a capa é a primeira pintura da home):
 *
 *   - o rodízio que trava no último slide em vez de voltar ao primeiro: com
 *     dois slides, "próximo do segundo" é o primeiro, e não um slide que não
 *     existe;
 *   - o ponto que aceso não corresponde à foto: a conta da rolagem tem de
 *     devolver o slide inteiro mais próximo, e não uma fração usada como
 *     índice (o `scrollLeft` no meio da transição acha o slide 1.4);
 *   - o rodízio andando com um slide só, ou andando para quem pediu menos
 *     movimento, ou andando por cima do botão de pausa — os três motivos de
 *     parada são a WCAG 2.2.2 e a `prefers-reduced-motion`.
 *
 * Como em `ticker.spec.ts`, o import é explícito e não `globals: true`: o `tsc`
 * deste pacote roda e os globais dariam erro de tipo.
 */
import { describe, expect, it } from "vitest"

import {
  HERO_SCROLL_SETTLE_MS,
  nextIndex,
  shouldAutoplay,
  slideIndexFromScroll,
} from "./hero-carousel"

describe("nextIndex", () => {
  it("anda um slide", () => {
    expect(nextIndex(0, 3)).toBe(1)
    expect(nextIndex(1, 3)).toBe(2)
  })

  it("no último, volta para o primeiro (a volta é o que dá o laço)", () => {
    expect(nextIndex(2, 3)).toBe(0)
    expect(nextIndex(1, 2)).toBe(0)
  })

  it("um slide só não tem próximo", () => {
    expect(nextIndex(0, 1)).toBe(0)
    expect(nextIndex(0, 0)).toBe(0)
  })

  it("índice fora da lista volta para dentro antes de andar", () => {
    expect(nextIndex(7, 3)).toBe(2)
    expect(nextIndex(-1, 3)).toBe(0)
  })

  it("índice que não é número é o começo", () => {
    expect(nextIndex(Number.NaN, 3)).toBe(1)
  })
})

describe("slideIndexFromScroll", () => {
  it("no começo, o primeiro slide", () => {
    expect(slideIndexFromScroll(0, 1200, 3)).toBe(0)
  })

  it("uma largura à frente, o slide seguinte", () => {
    expect(slideIndexFromScroll(1200, 1200, 3)).toBe(1)
    expect(slideIndexFromScroll(2400, 1200, 3)).toBe(2)
  })

  it("no meio da transição, o slide mais próximo (e não a fração)", () => {
    expect(slideIndexFromScroll(1300, 1200, 3)).toBe(1)
    expect(slideIndexFromScroll(1800, 1200, 3)).toBe(2)
  })

  it("rolagem além do fim para no último slide", () => {
    expect(slideIndexFromScroll(9999, 1200, 3)).toBe(2)
  })

  it("rolagem antes do começo para no primeiro", () => {
    expect(slideIndexFromScroll(-40, 1200, 3)).toBe(0)
  })

  it("trilho não medido (largura zero) é o começo, e não `Infinity`", () => {
    expect(slideIndexFromScroll(0, 0, 3)).toBe(0)
  })

  it("lista vazia é o começo", () => {
    expect(slideIndexFromScroll(1200, 1200, 0)).toBe(0)
  })
})

describe("shouldAutoplay", () => {
  const limpo = {
    count: 2,
    reducedMotion: false,
    paused: false,
    held: false,
  }

  it("com dois slides e ninguém segurando, roda", () => {
    expect(shouldAutoplay(limpo)).toBe(true)
  })

  it("um slide só não roda (não há o que trocar)", () => {
    expect(shouldAutoplay({ ...limpo, count: 1 })).toBe(false)
    expect(shouldAutoplay({ ...limpo, count: 0 })).toBe(false)
  })

  it("menos movimento no sistema para o rodízio", () => {
    expect(shouldAutoplay({ ...limpo, reducedMotion: true })).toBe(false)
  })

  it("o botão de pausa para o rodízio", () => {
    expect(shouldAutoplay({ ...limpo, paused: true })).toBe(false)
  })

  it("ponteiro em cima, foco dentro ou aba oculta param o rodízio", () => {
    expect(shouldAutoplay({ ...limpo, held: true })).toBe(false)
  })
})

describe("as constantes", () => {
  it("a janela de silêncio depois do `scrollTo` é maior que zero", () => {
    // Não é sobre o valor: um `0` aqui desligaria a proteção contra o
    // pisca-pisca dos pontos — a rolagem suave passa pelos slides
    // intermediários, e cada passagem acenderia o ponto dela.
    expect(HERO_SCROLL_SETTLE_MS).toBeGreaterThan(0)
  })
})
