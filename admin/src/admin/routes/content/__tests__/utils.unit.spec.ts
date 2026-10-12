/**
 * As contas puras do editor de conteúdo.
 * -------------------------------------------------------------------------
 * `toRows` monta as linhas do formulário a partir dos campos do contrato — com o
 * trilho de aparência logo abaixo do campo que ele veste —, `railNote` decide
 * quando o aviso do fundo escuro aparece, `creatableTypes` tira da lista os tipos
 * únicos que já existem, `freeAnchor` sugere uma âncora livre e `numeralFor` prevê
 * a casa que a seção vai receber quando a ordem pendente for publicada.
 *
 * Os quatro primeiros são do painel; o último é a **mesma conta** que o
 * `applyOrder` do backend faz (`modules/content/order.ts`), e é por isso que ele
 * tem caso próprio: se o painel previsse um número que a gravação não segue, o
 * lojista veria na tela um numeral que a loja nunca publica.
 *
 * Como os outros testes deste pacote, é de função pura: sem jsdom, sem rede, sem
 * banco — as fixtures são literais, e os `import type` somem no transform.
 */
import type { ContentSurfaceSpec } from "@conteudo/contract"
import type { OrderFaixa } from "@conteudo/order"

import type { FieldSpec } from "../field-input"
import type { Schema, Section } from "../types"
import {
  BACKGROUND_RAIL,
  creatableTypes,
  freeAnchor,
  numeralFor,
  railNote,
  toRows,
} from "../utils"

/** Um campo de conteúdo simples, com o que o caso precisar por cima. */
const field = (name: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  name,
  label: name,
  kind: "text",
  ...extra,
})

/** Uma seção como a API a devolve (achatada). */
const section = (type: string): Section => ({
  id: type,
  type,
  enabled: true,
  position: 5,
  fixed: false,
})

describe("toRows", () => {
  it("empilha os campos do mesmo trilho numa linha só, na ordem do contrato", () => {
    const rows = toRows([
      field("headline"),
      field("headingColor", { group: "Títulos", attachedTo: "headline" }),
      field("headingFont", { group: "Títulos", attachedTo: "headline" }),
      field("body"),
      field("background", { group: BACKGROUND_RAIL, attachedTo: "body" }),
    ])

    expect(rows.map((row) => row.kind)).toEqual([
      "field",
      "rail",
      "field",
      "rail",
    ])

    const rails = rows.filter((row) => row.kind === "rail")

    expect(rails.map((row) => row.group)).toEqual(["Títulos", BACKGROUND_RAIL])
    // Os dois campos do trilho saem juntos, e na ordem em que o contrato os
    // declarou: é a ordem do array, não um mapa montado no painel, que decide
    // onde a fonte do título aparece.
    expect(rails[0].specs.map((spec) => spec.name)).toEqual([
      "headingColor",
      "headingFont",
    ])
  })

  it("um campo de conteúdo no meio fecha o trilho", () => {
    const rows = toRows([
      field("headingColor", { group: "Títulos" }),
      field("headline"),
      field("headingFont", { group: "Títulos" }),
    ])

    // Dois trilhos de mesmo rótulo, e não um só: o grupo voltando depois de um
    // campo de conteúdo é outro trilho — é o que a âncora (`attachedTo`) do
    // contrato existe para impedir.
    expect(rows.map((row) => row.kind)).toEqual(["rail", "field", "rail"])
  })
})

describe("railNote", () => {
  const DARK = ["preto", "cacao"] as const

  /** O trilho `group` das specs dadas, para o aviso ser conferido nele. */
  const railOf = (group: string, specs: FieldSpec[]) => {
    const row = toRows(specs).find(
      (candidate) => candidate.kind === "rail" && candidate.group === group
    )

    if (!row || row.kind !== "rail") {
      throw new Error(`sem trilho "${group}"`)
    }

    return row
  }

  it("avisa quando o fundo escolhido é um dos escuros", () => {
    const row = railOf(BACKGROUND_RAIL, [
      field("background", { group: BACKGROUND_RAIL }),
    ])

    expect(railNote(row, { background: "preto" }, DARK)).toContain(
      "Fundo escuro"
    )
  })

  it("cala o aviso no fundo claro, no trilho sem aviso e sem os tokens", () => {
    const fundo = railOf(BACKGROUND_RAIL, [
      field("background", { group: BACKGROUND_RAIL }),
    ])
    const titulos = railOf("Títulos", [
      field("headingColor", { group: "Títulos" }),
    ])

    // Aviso que está sempre escrito vira ruído: só a escolha escura o acende.
    expect(railNote(fundo, { background: "" }, DARK)).toBeUndefined()
    expect(railNote(fundo, { background: "preto" }, undefined)).toBeUndefined()
    // Só o trilho do fundo tem efeito automático para o aviso anunciar.
    expect(railNote(titulos, { headingColor: "preto" }, DARK)).toBeUndefined()
  })
})

describe("creatableTypes", () => {
  const schema = { singletonTypes: ["nav"] } as unknown as Schema
  const home = {
    id: "home",
    types: ["hero", "nav", "editorial"],
  } as unknown as ContentSurfaceSpec

  it("tira da lista os tipos únicos que já existem", () => {
    expect(creatableTypes(schema, [], home)).toEqual([
      "hero",
      "nav",
      "editorial",
    ])
    expect(creatableTypes(schema, [section("nav")], home)).toEqual([
      "hero",
      "editorial",
    ])
  })

  it("oferece o que a superfície cria, e não o catálogo inteiro", () => {
    // A aba do tema não oferece "Hero": nenhum render daquela superfície lê o
    // tipo, e criar ali seria criar uma linha que a loja não desenha.
    const theme = {
      id: "theme",
      types: ["theme"],
    } as unknown as ContentSurfaceSpec

    expect(creatableTypes(schema, [], theme)).toEqual(["theme"])
    // Sem superfície não há o que criar — nem uma lista para oferecer.
    expect(creatableTypes(schema, [])).toEqual([])
  })
})

describe("freeAnchor", () => {
  it("sugere o tipo como âncora, e numera as repetições", () => {
    expect(freeAnchor("hero", [])).toBe("hero")
    expect(freeAnchor("hero", [section("hero")])).toBe("hero-2")
    expect(freeAnchor("hero", [section("hero"), section("hero-2")])).toBe(
      "hero-3"
    )
  })
})

describe("numeralFor", () => {
  it("pula as casas ancoradas, como a renumeração do backend", () => {
    // Na home a faixa começa em 5, de 1 em 1, e a casa 10 é do rodapé: as
    // ordenáveis ficam em 5 a 9 e, a partir da sexta, em 11 — a mesma sequência
    // que o `applyOrder` grava.
    const home: OrderFaixa = { first: 5, step: 1, reserved: [10] }

    expect([0, 1, 2, 3, 4].map((place) => numeralFor(place, home))).toEqual([
      5, 6, 7, 8, 9,
    ])
    expect(numeralFor(5, home)).toBe(11)
    expect(numeralFor(6, home)).toBe(12)
  })

  it("numera de 10 em 10 onde não há casas ancoradas", () => {
    const theme: OrderFaixa = { first: 10, step: 10, reserved: [] }

    expect(numeralFor(0, theme)).toBe(10)
    expect(numeralFor(2, theme)).toBe(30)
  })
})
