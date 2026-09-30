/**
 * O tema como dado: a fusão, o achatamento e a cobertura dos campos.
 * -------------------------------------------------------------------------
 * O `theme.json` e a linha de `content_section` saem das **mesmas** listas
 * (`THEME_FILES`, e dela `THEME_SECTIONS`), então o que se testa aqui não é
 * "os dois concordam" — é que a transformação está certa: a paleta do padrão
 * vem do contrato (a origem é uma só), o achatamento usa os nomes que a loja lê
 * (`themeColorField`/`themeFontField`) e "em branco é herdar o padrão" continua
 * valendo — a estação declara só o que troca.
 *
 * A cobertura de `THEME_FIELDS` mora aqui pelo mesmo motivo: é a lista que o
 * CRM desenha e a API valida, e uma cor nova no contrato sem campo no editor
 * tem de reprovar **antes** de virar dado que o lojista não consegue corrigir.
 */
import {
  FONT_ROLES,
  HEX_COLOR_PATTERN,
  MONTH_DAY_PATTERN,
  THEME_COLOR_HEXES,
  THEME_COLOR_TOKENS,
  THEME_FIELDS,
  THEME_FONT_FAMILIES,
  THEME_FONT_OPTIONS,
  THEME_FONTS,
  THEME_TYPE,
  themeColorField,
  themeFontField,
} from "../contract"
import { THEME_DEFAULT, THEME_FILES, THEME_SECTIONS } from "../themes"

/** O campo do contrato pelo nome que o CRM e o `data` usam. */
const field = (name: string) => THEME_FIELDS.find((spec) => spec.name === name)

describe("THEME_FILES", () => {
  it("o tema padrão é a paleta e as famílias do contrato", () => {
    const [base] = THEME_FILES

    expect(base.id).toBe(THEME_DEFAULT.id)
    expect(base.colors).toEqual(THEME_COLOR_HEXES)
    expect(base.fonts).toEqual(
      Object.fromEntries(
        FONT_ROLES.map((role) => [role, THEME_FONTS[role].family])
      )
    )
  })

  it("o padrão não tem janela; toda estação tem começo e fim", () => {
    const [base, ...seasons] = THEME_FILES

    expect(base.dateRange).toBeNull()
    expect(seasons.length).toBeGreaterThan(0)
    expect(
      seasons.every(
        (theme) =>
          Boolean(theme.dateRange?.start) && Boolean(theme.dateRange?.end)
      )
    ).toBe(true)
  })

  it("toda cor gravada é `#rrggbb` (ela vira variável CSS na loja)", () => {
    const ruins = THEME_FILES.flatMap((theme) =>
      Object.entries(theme.colors)
        .filter(([, hex]) => !new RegExp(HEX_COLOR_PATTERN).test(String(hex)))
        .map(([token]) => `${theme.id}.${token}`)
    )

    expect(ruins).toEqual([])
  })
})

describe("THEME_SECTIONS", () => {
  it("uma linha por tema, com o tipo e a ordem do contrato", () => {
    expect(THEME_SECTIONS.map((row) => row.id)).toEqual(
      THEME_FILES.map((theme) => theme.id)
    )
    expect(THEME_SECTIONS.every((row) => row.type === THEME_TYPE)).toBe(true)
    expect(THEME_SECTIONS.every((row) => row.enabled === true)).toBe(true)
    expect(THEME_SECTIONS.map((row) => row.position)).toEqual(
      THEME_FILES.map((_, index) => (index + 1) * 10)
    )
  })

  it("achata cor e fonte pelos nomes do contrato, sem inventar campo", () => {
    const conhecidos = new Set([
      "id",
      "type",
      "enabled",
      "position",
      ...THEME_FIELDS.map((spec) => spec.name),
    ])
    const problemas: string[] = []

    for (const theme of THEME_FILES) {
      const row = THEME_SECTIONS.find((candidate) => candidate.id === theme.id)

      if (row?.label !== theme.label) {
        problemas.push(`${theme.id}.label`)
      }

      for (const token of THEME_COLOR_TOKENS) {
        const key = themeColorField(token)

        if (row?.[key] !== theme.colors[token]) {
          problemas.push(`${theme.id}.${key}`)
        }
      }

      for (const role of FONT_ROLES) {
        const key = themeFontField(role)

        if (row?.[key] !== theme.fonts[role]) {
          problemas.push(`${theme.id}.${key}`)
        }
      }

      for (const key of Object.keys(row ?? {})) {
        if (!conhecidos.has(key)) {
          problemas.push(`${theme.id}.${key} (sem campo no editor)`)
        }
      }
    }

    expect(problemas).toEqual([])
  })

  it("'em branco é herdar o padrão': a estação não grava o que não troca", () => {
    const natal = THEME_SECTIONS.find((row) => row.id === "natal")
    const padrao = THEME_SECTIONS.find((row) => row.id === THEME_DEFAULT.id)

    // O Natal troca três cores e nenhuma fonte.
    expect(natal?.[themeColorField("rose")]).toBe("#8E3B3B")
    expect(natal?.[themeColorField("cacao")]).toBeUndefined()
    expect(natal?.[themeFontField("display")]).toBeUndefined()
    // E o padrão grava tudo: é dele que os brancos herdam.
    expect(padrao?.[themeColorField("cacao")]).toBe(THEME_COLOR_HEXES.cacao)
    expect(padrao?.[themeFontField("display")]).toBe(THEME_FONTS.display.family)
  })
})

describe("THEME_FIELDS", () => {
  it("cobre cada cor da paleta com um campo `hex` no formato do contrato", () => {
    for (const token of THEME_COLOR_TOKENS) {
      const spec = field(themeColorField(token))

      expect(spec?.kind).toBe("hex")
      expect(spec?.pattern).toBe(HEX_COLOR_PATTERN)
      expect(spec?.label).toBeTruthy()
    }
  })

  it("cobre cada papel de fonte com um select das famílias que a loja carrega", () => {
    expect(THEME_FONT_FAMILIES).toEqual(
      FONT_ROLES.map((role) => THEME_FONTS[role].family)
    )

    for (const role of FONT_ROLES) {
      const spec = field(themeFontField(role))

      expect(spec?.kind).toBe("select")
      // O "herda o padrão" na frente, e nenhuma família sem tradução.
      expect(spec?.options).toEqual(THEME_FONT_OPTIONS)
      expect(spec?.options?.[0]).toBe("")
      expect(
        (spec?.options ?? []).every((option) => spec?.optionLabels?.[option])
      ).toBe(true)
    }
  })

  it("o nome da estação é obrigatório e a janela tem o formato MM-DD", () => {
    expect(field("label")?.required).toBe(true)
    expect(field("dateRangeStart")?.pattern).toBe(MONTH_DAY_PATTERN)
    expect(field("dateRangeEnd")?.pattern).toBe(MONTH_DAY_PATTERN)
  })

  it("o formato da janela aceita o que o seed grava e recusa o resto", () => {
    const pattern = new RegExp(MONTH_DAY_PATTERN)

    expect(pattern.test("11-20")).toBe(true)
    expect(pattern.test("12-27")).toBe(true)
    expect(pattern.test("03-20")).toBe(true)
    // Mês 13, dia sem zero à esquerda e a data com ano: nenhum deles é a janela
    // anual que o storefront compara com o dia de hoje.
    expect(pattern.test("13-01")).toBe(false)
    expect(pattern.test("1-1")).toBe(false)
    expect(pattern.test("2026-11-20")).toBe(false)
  })
})
