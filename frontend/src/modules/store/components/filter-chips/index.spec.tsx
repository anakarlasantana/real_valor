/**
 * A fileira dos filtros aplicados: os chips, e o vazio.
 * -------------------------------------------------------------------------
 * O desenho do chip é o `.rv-chip` do `brand.css` — o **mesmo** do estado da peça
 * no card —, então o que se testa aqui é: a lista com a classe da fileira, a classe
 * do chip em cada item e o silêncio quando não há filtro. Quem monta os rótulos é
 * `chipsDaSelecao`, com teste em `lib/util/filter-chips.spec.ts`.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import FilterChips from "."

const html = (props: Parameters<typeof FilterChips>[0]) =>
  renderToStaticMarkup(<FilterChips {...props} />)

const chips = [
  { key: "color" as const, valor: "Preto", rotulo: "Cor: Preto" },
  { key: "size" as const, valor: "P", rotulo: "Tamanho: P" },
]

describe("FilterChips", () => {
  it("desenha um chip por filtro aplicado, com o rótulo da loja", () => {
    const markup = html({ chips })

    expect(markup).toContain('class="rv-filter-chips"')
    expect(markup).toContain('class="rv-chip"')
    expect(markup).toContain("Cor: Preto")
    expect(markup).toContain("Tamanho: P")
  })

  it("a fileira é uma lista, e cada filtro é um item dela", () => {
    const markup = html({ chips })

    expect(markup.startsWith("<ul")).toBe(true)
    expect(markup.split("<li").length - 1).toBe(2)
    expect(markup).toContain('aria-label="Filtros aplicados"')
  })

  it("sem filtro aplicado, nada é desenhado", () => {
    expect(html({})).toBe("")
    expect(html({ chips: [] })).toBe("")
    expect(html({ chips: null })).toBe("")
  })

  it("um filtro só já é uma fileira", () => {
    const markup = html({ chips: [chips[0]] })

    expect(markup).toContain("Cor: Preto")
    expect(markup).not.toContain("Tamanho: P")
  })
})
