/**
 * A tolerância da loja, que é o que impede que um **tipo novo gravado no
 * schema sem deploy** derrube a home: o render da home é exaustivo e o `default`
 * chama `assertNever`, que lança. Uma seção desconhecida que chegasse ao render
 * viraria HTTP 500 na página inteira — então ela é descartada antes.
 */
// Import explícito, e não `globals: true`: o `describe`/`it`/`expect` Globais
// dariam erro de tipo no `tsc` (que roda neste pacote), e o import deixa o
// arquivo com a mesma forma em qualquer runner.
import { describe, expect, it } from "vitest"

import {
  DEFAULT_HOME_SECTIONS,
  isSectionType,
  pageState,
  publishedSections,
  visibleSections,
} from "@lib/content/home-sections"
import { supportedSections } from "./supported-sections"

describe("supportedSections", () => {
  it("mantém as seções de tipo conhecido", () => {
    const raw = [
      { id: "hero", type: "hero", enabled: true, position: 20 },
      { id: "benefits", type: "benefits", enabled: true, position: 30 },
    ]

    expect(supportedSections(raw, 1)).toEqual(raw)
  })

  it("descarta o tipo que a loja não conhece (é o que a mantém de pé)", () => {
    const raw = [
      { id: "hero", type: "hero", enabled: true, position: 20 },
      // Gravado no registro do schema, sem deploy da loja:
      { id: "loja", type: "loja-de-marca-nova", enabled: true, position: 95 },
    ]

    expect(supportedSections(raw, 1)).toEqual([raw[0]])
  })

  it("descarta o que não tem `type` utilizável, sem estourar", () => {
    const raw = [null, undefined, {}, { type: 7 }, { type: "hero" }]

    expect(supportedSections(raw, 1)).toEqual([{ type: "hero" }])
  })

  it("aceita um payload que não é lista e devolve vazio", () => {
    expect(supportedSections(null, 1)).toEqual([])
    expect(supportedSections({ sections: [] }, 1)).toEqual([])
  })

  it("o conteúdo padrão da própria loja passa inteiro (sanidade do filtro)", () => {
    // Se o filtro fosseGMT largo demais, a home cairia no padrão sem ninguém
    // perceber: é o caso em que a vitrine fica "vazia" sem erro.
    const ids = DEFAULT_HOME_SECTIONS.map((section) => section.id)

    expect(supportedSections(DEFAULT_HOME_SECTIONS, 1).map((s) => s.id)).toEqual(
      DEFAULT_HOME_SECTIONS.filter((section) => isSectionType(section.type)).map(
        (section) => section.id
      )
    )
    expect(ids.length).toBeGreaterThan(0)
  })
})

/**
 * A régua do "no ar" — a que o CRM lê para dizer "publicada".
 * -------------------------------------------------------------------
 * A tela "Páginas" do CRM (F3a, item 2, do doc 14) mostra três estados, e o
 * estado não é digitado por ninguém: ele sai de `publishedSections` +
 * `pageState` (`@rv/contrato`), a mesma régua que a rota `[slug]` aplica antes
 * do `notFound()`. O que se confere aqui é a **premissa** dessa partilha: a
 * régua do contrato não é um filtro a mais por cima dos dois filtros da loja
 * (`supportedSections`, o tipo conhecido, e `visibleSections`, o habilitado).
 *
 * Sem este teste, um aperto futuro na régua (excluir um tipo da conta, por
 * exemplo) faria o CRM dizer "Despublicada" para um endereço que responde 200 —
 * a mentira exata que a tela existe para não contar. Com ele, o aperto reprova
 * aqui, no mesmo commit.
 */
describe("a régua do `no ar` (a que o CRM lê na tela Páginas)", () => {
  /** Um payload como o da Store API: só habilitadas, e todas de tipo conhecido. */
  const daLoja = () => {
    const base = DEFAULT_HOME_SECTIONS[0]

    return visibleSections(
      supportedSections(
        [
          ...DEFAULT_HOME_SECTIONS,
          { ...base, id: "oculta", enabled: false },
          // Gravado no registro do schema sem deploy da loja.
          { ...base, id: "nova", type: "loja-de-marca-nova" },
        ],
        1
      )
    )
  }

  it("não tira nada do que os dois filtros da loja já deixaram passar", () => {
    const publicadas = daLoja()

    expect(publicadas.length).toBeGreaterThan(0)
    expect(publishedSections(publicadas)).toEqual(publicadas)
  })

  it("e o que ela descarta é o que a loja não desenha", () => {
    const cru = [
      { id: "no-ar", type: "editorial", enabled: true },
      { id: "oculta", type: "editorial", enabled: false },
      { id: "desconhecida", type: "loja-de-marca-nova", enabled: true },
    ]

    expect(publishedSections(cru).map((section) => section.id)).toEqual(["no-ar"])
    expect(pageState(cru)).toBe("published")
    expect(pageState(cru.filter((section) => section.id === "oculta"))).toBe(
      "unpublished"
    )
    expect(pageState([])).toBe("empty")
  })
})
