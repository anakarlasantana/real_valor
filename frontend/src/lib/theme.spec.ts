/**
 * A regra do tema: o payload vira `Theme`, e a data escolhe a estação.
 * -------------------------------------------------------------------------
 * Desde a R5 o tema não vem de arquivo lido em request-time: são linhas de
 * `content_section` na superfície `theme`, servidas por
 * `GET /store/content?surface=theme` **achatadas** (o `data` no nível raiz, como
 * toda rota de conteúdo). O que se prende aqui é a conversão e a decisão:
 * o nome de cada campo sai do contrato, campo ausente herda o `default`, e a
 * janela de `MM-DD` mais estreita vence — inclusive quando ela vira o ano.
 *
 * Import explícito do runner (e não `globals: true`), como nos outros specs do
 * storefront: o `tsc` roda neste pacote e `describe`/`it`/`expect` globais
 * seriam erro de tipo.
 */
import { describe, expect, it, vi } from "vitest"

import {
  FONT_ROLES,
  THEME_COLOR_HEXES,
  THEME_COLOR_TOKENS,
  THEME_FONTS,
  themeColorField,
  themeFontField,
} from "@lib/content/home-sections"
import {
  resolveTheme,
  themeToCSSVariables,
  themesFromRows,
} from "@lib/theme"

/** A linha como a API a devolve: achatada, com as colunas de controle. */
const row = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  enabled: true,
  position: 10,
  fixed: false,
  type: "theme",
  ...data,
})

describe("themesFromRows", () => {
  it("lê a paleta e as fontes pelos nomes que o contrato publica", () => {
    const [theme] = themesFromRows([
      row("natal", {
        label: "Natal",
        dateRangeStart: "11-15",
        dateRangeEnd: "12-26",
        [themeColorField("rose")]: "#8E3B3B",
        [themeFontField("display")]: "Allura",
      }),
    ])

    expect(theme.id).toBe("natal")
    expect(theme.label).toBe("Natal")
    expect(theme.dateRange).toEqual({ start: "11-15", end: "12-26" })
    expect(theme.colors.rose).toBe("#8E3B3B")
    expect(theme.fonts.display).toBe("Allura")
  })

  it("campo ausente herda o tema padrão (a estação declara só o que troca)", () => {
    const [theme] = themesFromRows([row("natal", { label: "Natal" })])

    // O `default` é a paleta do contrato — o `theme.json` gerado dele.
    expect(theme.colors).toEqual(THEME_COLOR_HEXES)
    expect(theme.fonts.display).toBe(THEME_FONTS.display.family)
    // Sem janela, a estação não concorre: `resolveTheme` ignora quem não tem
    // `dateRange`, que é o que mantém o `default` como o "sempre no ar".
    expect(theme.dateRange).toBeNull()
  })

  it("descarta a linha que não é tema (e diz que descartou)", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const themes = themesFromRows([
      row("hero", { type: "hero" }),
      { enabled: true, type: "theme" },
      row("ok", { label: "Certo" }),
    ])

    expect(themes.map((theme) => theme.id)).toEqual(["ok"])
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it("payload que não é lista não vira tema nenhum", () => {
    expect(themesFromRows(undefined)).toEqual([])
    expect(themesFromRows({ sections: [] })).toEqual([])
  })
})

describe("resolveTheme", () => {
  /** As três estações do seed, como o payload as entrega. */
  const seasons = themesFromRows([
    row("black-friday", {
      label: "Black Friday",
      dateRangeStart: "11-20",
      dateRangeEnd: "11-30",
    }),
    row("natal", {
      label: "Natal",
      dateRangeStart: "11-15",
      dateRangeEnd: "12-26",
    }),
    row("verao", {
      label: "Verão",
      dateRangeStart: "12-27",
      dateRangeEnd: "03-20",
    }),
  ])

  it("sem tema nenhum, a loja pinta com o padrão embutido", () => {
    const theme = resolveTheme([], new Date(2026, 8, 29))

    expect(theme.id).toBe("default")
    expect(theme.colors).toEqual(THEME_COLOR_HEXES)
  })

  it("a janela mais estreita vence (Black Friday ganha do Natal)", () => {
    // 25 de novembro está nas duas janelas: 11 dias contra 42.
    expect(resolveTheme(seasons, new Date(2026, 10, 25)).id).toBe("black-friday")
  })

  it("fora de qualquer janela, o padrão", () => {
    expect(resolveTheme(seasons, new Date(2026, 8, 29)).id).toBe("default")
  })

  it("a janela do Verão vira o ano (12-27 → 03-20)", () => {
    expect(resolveTheme(seasons, new Date(2026, 11, 28)).id).toBe("verao")
    expect(resolveTheme(seasons, new Date(2027, 0, 15)).id).toBe("verao")
    expect(resolveTheme(seasons, new Date(2027, 2, 20)).id).toBe("verao")
    // Um dia depois do fim, ninguém está no ar.
    expect(resolveTheme(seasons, new Date(2027, 2, 21)).id).toBe("default")
  })

  it("a estação escolhida é quem define as variáveis da página", () => {
    const vars = themeToCSSVariables(
      resolveTheme(seasons, new Date(2026, 10, 25))
    )
    const esperado = [
      ...THEME_COLOR_TOKENS.map((token) => `--rv-${token}`),
      ...FONT_ROLES.map((role) => `--rv-font-${role}`),
    ]

    expect(Object.keys(vars).sort()).toEqual([...esperado].sort())
    expect(vars["--rv-font-display"]).toBe(
      `"${THEME_FONTS.display.family}", ${THEME_FONTS.display.fallback}`
    )
  })
})
