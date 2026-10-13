/**
 * Os chips dos filtros aplicados: o que cada um diz, e em que ordem.
 * -------------------------------------------------------------------------
 * O que este teste protege:
 *
 *   - **o rótulo é o da loja, não o da URL**: o valor marcado é `P` ou `0-300`, e o
 *     chip diz "Tamanho: P" e "Faixa de preço: Até R$ 300" — a mesma leitura do
 *     painel, porque o rótulo sai do mesmo lugar (as facetas);
 *   - **todo filtro aplicado tem chip**, inclusive o valor que o catálogo não tem
 *     mais (um link compartilhado cuja peça saiu do ar): ele cai para o valor cru,
 *     que é o critério do próprio painel;
 *   - **a ordem é fixa** (a das facetas), e não a ordem em que a URL foi escrita —
 *     uma fileira que dança a cada clique é uma fileira que se relê.
 */
import { describe, expect, it } from "vitest"

import {
  CHAVES_DE_FACETA,
  tituloDaFaceta,
  type Faceta,
} from "./catalog-filters"
import { chipsDaSelecao, rotuloDoChip } from "./filter-chips"

/** A faceta de cor, com o rótulo da loja ("Preto (4)" é o do painel). */
const cor: Faceta = {
  key: "color",
  title: "Cor",
  options: [
    { value: "Preto", label: "Preto", count: 4 },
    { value: "Cacau", label: "Cacau", count: 2 },
  ],
}

const tamanho: Faceta = {
  key: "size",
  title: "Tamanho",
  options: [{ value: "P", label: "P", count: 3 }],
}

const preco: Faceta = {
  key: "price",
  title: "Faixa de preço",
  options: [{ value: "0-300", label: "Até R$ 300", count: 5 }],
}

/** A faceta **na ordem do painel** — é dela que sai a ordem dos chips. */
const facetas = (extras: Faceta[] = []) => [cor, tamanho, ...extras]

describe("rotuloDoChip — a frase do chip", () => {
  it("junta o título da faceta e o valor", () => {
    expect(rotuloDoChip("Cor", "Preto")).toBe("Cor: Preto")
  })

  it("valor em branco não deixa dois-pontos pendurado", () => {
    expect(rotuloDoChip("Cor", "  ")).toBe("Cor")
  })
})

describe("chipsDaSelecao — o que a URL diz, em chips", () => {
  it("um chip por valor marcado, com o rótulo da loja", () => {
    expect(chipsDaSelecao(facetas(), { color: ["Preto"] })).toEqual([
      { key: "color", valor: "Preto", rotulo: "Cor: Preto" },
    ])
  })

  it("o rótulo vem da faceta: a faixa de preço diz \"Até R$ 300\", e não \"0-300\"", () => {
    expect(chipsDaSelecao(facetas([preco]), { price: ["0-300"] })).toEqual([
      { key: "price", valor: "0-300", rotulo: "Faixa de preço: Até R$ 300" },
    ])
  })

  it("dois valores na mesma faceta viram dois chips, na ordem da URL", () => {
    expect(
      chipsDaSelecao(facetas(), { color: ["Cacau", "Preto"] }).map(
        (chip) => chip.rotulo
      )
    ).toEqual(["Cor: Cacau", "Cor: Preto"])
  })

  it("a ordem é a das facetas, e não a das chaves da seleção", () => {
    // A seleção nomeia tamanho primeiro; o painel desenha categoria, tamanho, cor…
    // e a fileira sai na ordem do painel — "Tamanho" antes de "Cor" aqui porque é
    // a ordem de `CHAVES_DE_FACETA`.
    const chips = chipsDaSelecao(facetas(), {
      color: ["Preto"],
      size: ["P"],
    })

    expect(chips.map((chip) => chip.key)).toEqual(["size", "color"])
  })

  it("valor que o catálogo não tem mais continua tendo chip, com o valor cru", () => {
    // O caso do link compartilhado cuja peça saiu do ar: o filtro continua aplicado
    // (a URL diz isso) e a fileira não pode perdê-lo.
    expect(chipsDaSelecao(facetas(), { color: ["Vermelho"] })).toEqual([
      { key: "color", valor: "Vermelho", rotulo: "Cor: Vermelho" },
    ])
  })

  it("faceta que a página não desenhou cai para o título padrão", () => {
    // A faceta não veio (nenhum produto do recorte tem valor dela), mas a URL
    // marcou um valor: o chip existe, com o título de `tituloDaFaceta`.
    expect(
      chipsDaSelecao([], { availability: ["esgotado"] })
    ).toEqual([
      {
        key: "availability",
        valor: "esgotado",
        rotulo: "Disponibilidade: esgotado",
      },
    ])
  })

  it("sem seleção não há fileira", () => {
    expect(chipsDaSelecao(facetas(), {})).toEqual([])
    expect(chipsDaSelecao(facetas(), { color: [] })).toEqual([])
  })
})

describe("tituloDaFaceta — o título por chave, para fora do painel", () => {
  it("cobre as cinco facetas, sem sobra e sem falta", () => {
    for (const chave of CHAVES_DE_FACETA) {
      expect(tituloDaFaceta(chave).length).toBeGreaterThan(0)
    }

    expect(tituloDaFaceta("price")).toBe("Faixa de preço")
  })
})
