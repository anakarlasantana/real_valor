import "server-only"

import fs from "fs"
import path from "path"

import {
  FONT_ROLES,
  THEME_COLOR_TOKENS,
  THEME_FONTS,
  type FontRole,
  type ThemeColorToken,
} from "@lib/content/home-sections"

import defaultTheme from "../../themes/default/theme.json"

/**
 * Seasonal theme system (Fase 5 of the technical doc).
 *
 * The active theme is resolved at request time from the `themes/`
 * directory, so a season can exist without rebuilding the storefront.
 *
 * Desde a R3-lite o diretório é **gerado**: quem declara as estações é
 * `backend/src/modules/content/themes.ts`, e quem escreve os `theme.json` é
 * `node scripts/gen-content.mjs` (com o `--check` no `make check` e no hook de
 * commit). Largar uma pasta aqui à mão **não** cria uma estação — a guarda
 * reprova o diretório órfão, e de propósito: um tema que só a loja conhece
 * muda a cor da vitrine sem aparecer em lugar nenhum.
 *
 * Every theme falls back to `default` for any value it does not
 * override, which is the risk mitigation described in the doc:
 * "Default-theme fallback as risk mitigation".
 *
 * (A R4 leva essas estações para o banco como linhas de `content_section` e a
 * R5 faz a loja ler o payload — aí esta leitura de disco sai. Ver
 * `docs/plano-centralizacao.md`.)
 */

/**
 * A paleta e as fontes ativas, papel por papel.
 *
 * Os dois são `Record` das listas do **contrato** (`THEME_COLOR_TOKENS` e
 * `FONT_ROLES`, via `contract.generated.ts`) e não um objeto digitado aqui:
 * era o segundo lugar onde os seis nomes de cor e os três de fonte existiam, e
 * um token novo no contrato deixava este arquivo para trás sem erro nenhum —
 * a variável CSS saía sem valor e a seção ficava com a cor errada. O
 * significado de cada papel (rosa queimado, grafite...) está em
 * `styles/brand.css`, junto dos hex.
 */
export type ThemeColors = Record<ThemeColorToken, string>

export type ThemeFonts = Record<FontRole, string>

export type Theme = {
  id: string
  label: string
  /** `MM-DD` strings; `null` means "always available" (only for default). */
  dateRange: { start: string; end: string } | null
  colors: ThemeColors
  fonts: ThemeFonts
}

/** Shape of the JSON actually stored on disk (everything optional). */
type ThemeFile = {
  id: string
  label?: string
  dateRange?: { start: string; end: string } | null
  colors?: Partial<ThemeColors>
  fonts?: Partial<ThemeFonts>
}

const THEMES_DIR = path.join(process.cwd(), "themes")

const DEFAULT_THEME = defaultTheme as ThemeFile

const DEFAULT_THEME_ID = DEFAULT_THEME.id

/**
 * Reads every `themes/<id>/theme.json` and merges it over the default
 * theme. Unreadable or malformed files are skipped rather than thrown
 * so a single bad season can never take the storefront down.
 */
function loadThemes(): Theme[] {
  let entries: string[] = []

  try {
    entries = fs.readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return [normalizeTheme(DEFAULT_THEME)]
  }

  const themes = entries
    .map((id) => {
      try {
        const raw = fs.readFileSync(
          path.join(THEMES_DIR, id, "theme.json"),
          "utf8"
        )
        return normalizeTheme(JSON.parse(raw) as ThemeFile)
      } catch {
        return null
      }
    })
    .filter((theme): theme is Theme => theme !== null)

  if (!themes.some((theme) => theme.id === DEFAULT_THEME_ID)) {
    themes.unshift(normalizeTheme(DEFAULT_THEME))
  }

  return themes
}

/** Merges a partial theme file over the default theme's values. */
function normalizeTheme(file: ThemeFile): Theme {
  return {
    id: file.id,
    label: file.label ?? file.id,
    dateRange: file.dateRange ?? null,
    colors: { ...DEFAULT_THEME.colors, ...file.colors } as ThemeColors,
    fonts: { ...DEFAULT_THEME.fonts, ...file.fonts } as ThemeFonts,
  }
}

/** Formats a `Date` as `MM-DD` so it can be compared with a dateRange. */
function toMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${month}-${day}`
}

/** Inclusive `MM-DD` window check that handles year wrap-around (ex.: verão). */
function isWithinRange(monthDay: string, range: { start: string; end: string }) {
  if (range.start <= range.end) {
    return monthDay >= range.start && monthDay <= range.end
  }

  // Window crosses the new year (ex.: 12-27 -> 03-20)
  return monthDay >= range.start || monthDay <= range.end
}

/**
 * Resolves the theme active for a given date.
 *
 * When several seasonal ranges overlap, the narrowest window wins so a
 * short campaign (Black Friday) beats a broad season (Natal).
 * Always returns a usable theme thanks to the default fallback.
 */
export function resolveTheme(date: Date = new Date()): Theme {
  const themes = loadThemes()
  const fallback =
    themes.find((theme) => theme.id === DEFAULT_THEME_ID) ??
    normalizeTheme(DEFAULT_THEME)

  const monthDay = toMonthDay(date)

  const matches = themes
    .filter(
      (theme) =>
        theme.dateRange && isWithinRange(monthDay, theme.dateRange)
    )
    .sort((a, b) => rangeLength(a.dateRange) - rangeLength(b.dateRange))

  return matches[0] ?? fallback
}

/** Approximate length of a `MM-DD` window in days, for overlap tie-breaking. */
function rangeLength(range: { start: string; end: string } | null): number {
  if (!range) {
    return Number.MAX_SAFE_INTEGER
  }

  const [startMonth, startDay] = range.start.split("-").map(Number)
  const [endMonth, endDay] = range.end.split("-").map(Number)

  const start = Date.UTC(2000, startMonth - 1, startDay)
  const end = Date.UTC(2000, endMonth - 1, endDay)

  const days = (end - start) / 86_400_000

  return days >= 0 ? days : days + 365
}

/**
 * Flattens a theme into the CSS custom properties consumed by
 * `brand.css`. Applied inline on `<html>` so the correct palette is
 * present in the first paint (no flash of the wrong theme).
 *
 * As duas listas de papéis vêm do contrato (pelo artefato gerado) e a pilha
 * de fonte é a família **da estação** mais o fallback que o contrato declara —
 * o mesmo do `tokens.generated.css`. Antes eram seis pares do tipo
 * `--rv-rose` → `theme.colors.rose` digitados aqui e três templates de pilha
 * com o fallback repetido: um token novo no contrato não aparecia na loja (e
 * um tema sazonal que trocasse de família continuava com a fonte antiga).
 */
export function themeToCSSVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const token of THEME_COLOR_TOKENS) {
    vars[`--rv-${token}`] = theme.colors[token]
  }

  for (const role of FONT_ROLES) {
    vars[`--rv-font-${role}`] =
      `"${theme.fonts[role]}", ${THEME_FONTS[role].fallback}`
  }

  return vars
}

/** Convenience helper for server components that need the active theme. */
export function getActiveTheme(): Theme {
  return resolveTheme(new Date())
}
