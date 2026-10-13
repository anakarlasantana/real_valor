/**
 * O carrossel de produtos — a régua, a página e a vez de andar.
 * -------------------------------------------------------------------------
 * O que este teste protege é o que, errado, aparece na tela de quem entra:
 *
 *   - a **contagem de páginas**. Ela é o que decide se o carrossel tem setas e
 *     pontos ou se é um trilho parado, e erra para os dois lados: uma página a
 *     mais acende um ponto que não leva a lugar nenhum (a última peça não encosta
 *     na esquerda, o `scrollTo` para no mesmo lugar) e uma a menos esconde a
 *     terceira peça de quem só usa as setas.
 *   - o **ponto aceso**. A conta da rolagem tem de devolver a página inteira mais
 *     próxima, e não a fração usada como índice (no meio da transição a conta dá
 *     0,5 página).
 *   - o **fim do trilho**, que é o caso em que a conta do meio erraria por um:
 *     com um card de esguelha, a última peça nunca chega à esquerda e o último
 *     ponto precisa acender assim mesmo.
 *   - o rodízio andando com uma página só, ou andando para quem pediu menos
 *     movimento, ou andando depois que o visitante assumiu o volante — os motivos
 *     de parada são a WCAG 2.2.2 e a `prefers-reduced-motion`.
 *
 * Como em `ticker.spec.ts`, o import é explícito e não `globals: true`: o `tsc`
 * deste pacote roda e os globais dariam erro de tipo.
 */
import { describe, expect, it } from "vitest"

import {
  CAROUSEL_AUTOPLAY_SECONDS,
  CAROUSEL_SCROLL_SETTLE_MS,
  itemsPerView,
  nextIndex,
  pageIndexFromScroll,
  pagesOf,
  shouldAutoplay,
} from "./carousel"

describe("itemsPerView", () => {
  it("três cards por tela no desktop — e o que cabe inteiro não tem página", () => {
    // O card do desktop é `calc(30% - 0.75rem)` com 1.5rem de vão: 343,2px num
    // trilho de 1184px (uma tela de 1280px menos o respiro de 3rem de cada lado).
    // Cabem 3,29: três cards inteiros e o pedaço do quarto atravessando a borda
    // direita — o desenho pedido, e a razão de a foto do card ter encolhido de
    // 461,6px para 343,2px (`brand.css`). Com três peças publicadas o pedaço não
    // existe, tudo cabe na tela e o carrossel **não tem página para trocar**:
    // nenhum controle, que é o certo — um ponto aceso que não leva a lugar
    // nenhum seria pior que não ter ponto.
    expect(itemsPerView(1184, 343.2, 24)).toBe(3.29)
    expect(pagesOf(3, itemsPerView(1184, 343.2, 24))).toBe(1)
  })

  it("dois cards e meio no tablet — e é o pedaço que faz a segunda página", () => {
    // A régua do tablet (`calc(40% - 0.75rem)` a partir de 512px): 276px num
    // trilho de 720px (uma tela de 768px menos o respiro de 1.5rem de cada lado).
    // Cabem 2,48 — dois cards inteiros e quase metade do terceiro —, e é essa
    // fração que põe a terceira peça na segunda página.
    expect(itemsPerView(720, 276, 24)).toBe(2.48)
    expect(pagesOf(3, itemsPerView(720, 276, 24))).toBe(2)
  })

  it("um card e um pedaço no celular — e é o pedaço que faz a terceira página", () => {
    // O trilho sangrado de 390px tem 358px de largura útil (o respiro de 1rem de
    // cada lado da tela) e o card é 76% dela, 272,08px: cabe 1,29 card. O pedaço
    // do próximo é o convite para arrastar, e a fração é o que separa "duas
    // telas" de "três".
    expect(itemsPerView(358, 272.08, 24)).toBe(1.29)
    expect(pagesOf(3, itemsPerView(358, 272.08, 24))).toBe(3)
  })

  it("ruído de pixel não vira página a mais", () => {
    // Dois cards de 50% medidos a menos de um milésimo de pixel dariam 1,99985 e
    // uma volta a mais num carrossel que não tem para onde rolar.
    expect(itemsPerView(1344, 660.05, 24)).toBe(2)
  })

  it("trilho não medido é um por tela", () => {
    expect(itemsPerView(0, 660, 24)).toBe(1)
    expect(itemsPerView(1344, 0, 24)).toBe(1)
    expect(itemsPerView(Number.NaN, 660, 24)).toBe(1)
  })

  it("vão ausente não inventa espaço", () => {
    expect(itemsPerView(1200, 600, Number.NaN)).toBe(2)
  })
})

describe("pagesOf", () => {
  it("três peças em dois por tela são duas páginas", () => {
    expect(pagesOf(3, 2)).toBe(2)
  })

  it("arredonda para cima: a sobra é a última página", () => {
    expect(pagesOf(5, 2)).toBe(3)
    expect(pagesOf(3, 1.29)).toBe(3)
  })

  it("o que cabe inteiro é uma página só", () => {
    expect(pagesOf(2, 2)).toBe(1)
    expect(pagesOf(1, 2)).toBe(1)
  })

  it("lista vazia é uma página (e não zero, que dividiria por zero)", () => {
    expect(pagesOf(0, 2)).toBe(1)
    expect(pagesOf(-3, 2)).toBe(1)
    expect(pagesOf(Number.NaN, 2)).toBe(1)
  })

  it("por-tela sem sentido cai para um", () => {
    expect(pagesOf(3, 0)).toBe(3)
    expect(pagesOf(3, Number.NaN)).toBe(3)
  })
})

describe("pageIndexFromScroll", () => {
  // O trilho do desktop com três peças: 3 × 461,6px + 2 vãos de 24px = 1432,8px
  // de conteúdo numa janela de 1184px (a tela de 1280px menos o respiro de 3rem
  // de cada lado), ou seja 248,8px de rolagem possível.
  const desktop = { clientWidth: 1184, scrollWidth: 1432.8, pageCount: 2 }
  // O do celular: 3 × 272,08px + 48px = 864,24px numa janela de 358px (a tela de
  // 390px menos o respiro de 1rem de cada lado) — 506,24px de rolagem possível.
  const mobile = { clientWidth: 358, scrollWidth: 864.24, pageCount: 3 }

  it("no começo, a primeira página", () => {
    expect(pageIndexFromScroll({ ...desktop, scrollLeft: 0 })).toBe(0)
    expect(pageIndexFromScroll({ ...mobile, scrollLeft: 0 })).toBe(0)
  })

  it("uma tela à frente, a segunda", () => {
    expect(pageIndexFromScroll({ ...mobile, scrollLeft: 358 })).toBe(1)
  })

  it("meio caminho já conta como a página seguinte", () => {
    // 179px de 358 é meia tela: o que está à frente já domina a leitura.
    expect(pageIndexFromScroll({ ...mobile, scrollLeft: 179 })).toBe(1)
  })

  it("chegar ao fim do trilho acende o último ponto", () => {
    expect(pageIndexFromScroll({ ...desktop, scrollLeft: 248.8 })).toBe(1)
  })

  it("o fim com card de esguelha acende o último ponto (a conta do meio erraria)", () => {
    // 506,24px é o máximo do trilho do celular, e a última peça não encosta na
    // esquerda: sem a regra do fim, 506,24 / 358 e 505 / 358 dariam 1,41 e
    // arredondariam para a página 1 — o último ponto nunca acenderia.
    expect(pageIndexFromScroll({ ...mobile, scrollLeft: 506.24 })).toBe(2)
    expect(pageIndexFromScroll({ ...mobile, scrollLeft: 505 })).toBe(2)
  })

  it("rolagem além do fim para no último ponto", () => {
    expect(pageIndexFromScroll({ ...desktop, scrollLeft: 9999 })).toBe(1)
  })

  it("rolagem antes do começo para no primeiro", () => {
    expect(pageIndexFromScroll({ ...desktop, scrollLeft: -40 })).toBe(0)
  })

  it("trilho não medido (largura zero) é o começo, e não `Infinity`", () => {
    expect(
      pageIndexFromScroll({ ...desktop, clientWidth: 0, scrollLeft: 0 })
    ).toBe(0)
  })

  it("uma página só nunca acende outro ponto", () => {
    expect(
      pageIndexFromScroll({ ...desktop, pageCount: 1, scrollLeft: 248.8 })
    ).toBe(0)
  })

  it("sem largura de conteúdo medida, a conta do meio vale", () => {
    expect(
      pageIndexFromScroll({
        ...mobile,
        scrollWidth: Number.NaN,
        scrollLeft: 358,
      })
    ).toBe(1)
  })
})

describe("nextIndex", () => {
  it("anda uma página", () => {
    expect(nextIndex(0, 3)).toBe(1)
    expect(nextIndex(1, 3)).toBe(2)
  })

  it("no último, volta para o primeiro (a volta é o que dá o laço)", () => {
    expect(nextIndex(2, 3)).toBe(0)
    expect(nextIndex(1, 2)).toBe(0)
  })

  it("uma página só não tem próxima", () => {
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

describe("shouldAutoplay", () => {
  const limpo = {
    pageCount: 2,
    reducedMotion: false,
    held: false,
    stopped: false,
    onScreen: true,
  }

  it("com duas páginas e ninguém segurando, roda", () => {
    expect(shouldAutoplay(limpo)).toBe(true)
  })

  it("uma página só não roda (não há o que trocar)", () => {
    expect(shouldAutoplay({ ...limpo, pageCount: 1 })).toBe(false)
    expect(shouldAutoplay({ ...limpo, pageCount: 0 })).toBe(false)
  })

  it("menos movimento no sistema para o rodízio", () => {
    expect(shouldAutoplay({ ...limpo, reducedMotion: true })).toBe(false)
  })

  it("ponteiro em cima, foco dentro ou aba oculta param o rodízio", () => {
    expect(shouldAutoplay({ ...limpo, held: true })).toBe(false)
  })

  it("carrossel fora da tela não roda", () => {
    expect(shouldAutoplay({ ...limpo, onScreen: false })).toBe(false)
  })

  it("depois do primeiro gesto do visitante, não volta a andar", () => {
    expect(shouldAutoplay({ ...limpo, stopped: true })).toBe(false)
  })
})

describe("as constantes", () => {
  it("o rodízio espera um tempo que dá para ler dois cards", () => {
    // Não é sobre o valor: um `0` aqui viraria troca a cada quadro.
    expect(CAROUSEL_AUTOPLAY_SECONDS).toBeGreaterThan(0)
  })

  it("a janela de silêncio depois do `scrollTo` é maior que zero", () => {
    // Um `0` desligaria a proteção contra o pisca-pisca dos pontos — a rolagem
    // suave passa pelas páginas intermediárias, e cada passagem acenderia o
    // ponto dela (e pararia o rodízio, no caso da vitrine).
    expect(CAROUSEL_SCROLL_SETTLE_MS).toBeGreaterThan(0)
  })
})
