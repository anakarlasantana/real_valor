/**
 * A avaliação de uma peça: o bloco que aparece, e o que não aparece.
 * -------------------------------------------------------------------------
 * O que este teste protege:
 *
 *   - **a leitura do `metadata`** — número e o texto que o painel grava quando
 *     alguém digita "4,9" com a vírgula daqui. Uma das duas formas não lida é uma
 *     avaliação que existe e não aparece;
 *   - **as recusas** que impedem um "7 de 5" e um "28,5 avaliações" de chegar à
 *     tela: campo trocado no painel não pode virar número afirmado pela loja;
 *   - **o texto em pt-BR** — "4,9", e não o "4.9" que a referência escreve (é um
 *     protótipo em inglês) e que o starter já produziu em toda a loja;
 *   - **o arredondamento das estrelas**, que é a única decisão de desenho que uma
 *     média deixa em aberto (4,9 são cinco estrelas; 3,4 são três);
 *   - e o principal: **sem os dois campos, não há avaliação nenhuma.**
 */
import { describe, expect, it } from "vitest"

import {
  avaliacaoDoProduto,
  avaliacaoValida,
  CHAVE_AVALIACAO_MEDIA,
  CHAVE_AVALIACAO_TOTAL,
  estrelasCheiasDaMedia,
  NOTA_MAXIMA,
  numeroDoMetadata,
  rotuloDaAvaliacao,
} from "./product-rating"

/** As duas chaves do `metadata`, como a loja as escreve. */
const metadata = (media: unknown, total: unknown) => ({
  [CHAVE_AVALIACAO_MEDIA]: media,
  [CHAVE_AVALIACAO_TOTAL]: total,
})

describe("avaliacaoDoProduto — o que a loja escreveu", () => {
  it("lê as duas chaves numéricas", () => {
    expect(avaliacaoDoProduto({ metadata: metadata(4.9, 28) })).toEqual({
      media: 4.9,
      total: 28,
    })
  })

  it("lê também o texto do painel, com a vírgula daqui", () => {
    // O campo de `metadata` do painel do Medusa grava texto quando é digitado à
    // mão, e quem digita "4,9" escreve a nota como se escreve em pt-BR.
    expect(avaliacaoDoProduto({ metadata: metadata("4,9", "28") })).toEqual({
      media: 4.9,
      total: 28,
    })
  })

  it("uma chave só não é avaliação: faltando qualquer uma, não há bloco", () => {
    expect(avaliacaoDoProduto({ metadata: metadata(4.9, undefined) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata(undefined, 28) })).toBeNull()
  })

  it("produto sem `metadata` (ou com metadata vazio) não tem avaliação", () => {
    expect(avaliacaoDoProduto({})).toBeNull()
    expect(avaliacaoDoProduto({ metadata: null })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: {} })).toBeNull()
  })

  it("valor que não é número nem texto numérico não vira nota", () => {
    expect(avaliacaoDoProduto({ metadata: metadata("muito boa", 28) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata({ nota: 5 }, 28) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata(true, 28) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata("", 28) })).toBeNull()
  })

  it("`NaN` e `Infinity` não passam (nem do número, nem do texto)", () => {
    expect(avaliacaoDoProduto({ metadata: metadata(NaN, 28) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata(Infinity, 28) })).toBeNull()
    expect(avaliacaoDoProduto({ metadata: metadata("Infinity", 28) })).toBeNull()
  })
})

describe("avaliacaoValida — a régua do dado", () => {
  it("nota acima de cinco é campo trocado, não avaliação excelente", () => {
    expect(avaliacaoValida(7, 10)).toBeNull()
    expect(avaliacaoValida(NOTA_MAXIMA, 10)).toEqual({ media: 5, total: 10 })
  })

  it("nota zero é ausência de avaliação, e não a pior nota", () => {
    expect(avaliacaoValida(0, 10)).toBeNull()
    expect(avaliacaoValida(-1, 10)).toBeNull()
  })

  it("contagem zerada, fracionada ou negativa não é contagem", () => {
    expect(avaliacaoValida(4.9, 0)).toBeNull()
    expect(avaliacaoValida(4.9, 2.5)).toBeNull()
    expect(avaliacaoValida(4.9, -3)).toBeNull()
    expect(avaliacaoValida(4.9, 1)).toEqual({ media: 4.9, total: 1 })
  })

  it("ausente não vira zero: os dois lados são obrigatórios", () => {
    expect(avaliacaoValida(null, 28)).toBeNull()
    expect(avaliacaoValida(4.9, null)).toBeNull()
    expect(avaliacaoValida(undefined, undefined)).toBeNull()
  })
})

describe("numeroDoMetadata — a tolerância de leitura", () => {
  it("espaço nas pontas e vírgula decimal não atrapalham", () => {
    expect(numeroDoMetadata(metadata(" 4,9 ", 28), CHAVE_AVALIACAO_MEDIA)).toBe(4.9)
  })

  it("chave ausente devolve `null`, e não zero", () => {
    expect(numeroDoMetadata({}, CHAVE_AVALIACAO_MEDIA)).toBeNull()
    expect(numeroDoMetadata(null, CHAVE_AVALIACAO_MEDIA)).toBeNull()
  })
})

describe("estrelasCheiasDaMedia — o arredondamento", () => {
  it("arredonda para a estrela mais próxima", () => {
    expect(estrelasCheiasDaMedia(4.9)).toBe(5)
    expect(estrelasCheiasDaMedia(4.4)).toBe(4)
    expect(estrelasCheiasDaMedia(3.5)).toBe(4)
    expect(estrelasCheiasDaMedia(3.4)).toBe(3)
  })

  it("nunca passa de cinco nem desce abaixo de zero", () => {
    expect(estrelasCheiasDaMedia(12)).toBe(NOTA_MAXIMA)
    expect(estrelasCheiasDaMedia(-3)).toBe(0)
    expect(estrelasCheiasDaMedia(NaN)).toBe(0)
  })
})

describe("rotuloDaAvaliacao — o texto ao lado das estrelas", () => {
  it("escreve a nota em pt-BR: vírgula, e não ponto", () => {
    // A referência escreve "4.9 · 28 avaliações" porque é um protótipo em inglês;
    // numa loja que escreve R$ 249,90 a nota também é 4,9.
    expect(rotuloDaAvaliacao({ media: 4.9, total: 28 })).toBe(
      "4,9 · 28 avaliações"
    )
  })

  it("a nota inteira ganha a casa decimal (5,0, e não 5)", () => {
    expect(rotuloDaAvaliacao({ media: 5, total: 3 })).toBe("5,0 · 3 avaliações")
  })

  it("uma avaliação é \"1 avaliação\"", () => {
    expect(rotuloDaAvaliacao({ media: 5, total: 1 })).toBe("5,0 · 1 avaliação")
  })
})
