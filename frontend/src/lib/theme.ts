import {
  FONT_ROLES,
  THEME_COLOR_TOKENS,
  THEME_FONTS,
  themeColorField,
  themeFontField,
  type FontRole,
  type ThemeColorToken,
} from "@lib/content/home-sections"

import defaultTheme from "../../themes/default/theme.json"

/**
 * Seasonal theme system (Fase 5 of the technical doc).
 *
 * As estações chegam pelo **payload** (`GET /store/content?surface=theme`, em
 * `lib/data/theme.ts`) desde a R5: elas são linhas de `content_section` na
 * superfície `theme`, editáveis no CRM. Até a R4 este arquivo lia os
 * `theme.json` de `themes/` em request-time — um `fs` que obrigava o Dockerfile
 * a copiar a pasta para a imagem e que, quando a cópia faltava, derrubava a loja
 * no tema padrão **em silêncio** (o `try`/`catch` engolia o erro). Não há mais
 * pasta para copiar: o que a loja lê é dado do banco, como o resto do conteúdo.
 *
 * O `theme.json` do `default` continua importado aqui de propósito: é o
 * **fallback embutido** (o JSON entra no bundle do build) para quando a API de
 * conteúdo falhar, e é dele que toda estação herda o que não declara —
 * `normalizeTheme`, abaixo. Ele nasce do contrato
 * (`backend/src/modules/content/themes.ts`, pelo `scripts/gen-content.mjs`).
 *
 * Este módulo é **puro**: quem fala com a API é `lib/data/theme.ts`, e o que dá
 * para testar sem servidor fica aqui (`theme.spec.ts`).
 *
 * Every theme falls back to `default` for any value it does not
 * override, which is the risk mitigation described in the doc:
 * "Default-theme fallback as risk mitigation".
 */

/**
 * A paleta e as fontes ativas, papel por papel.
 *
 * Os dois são `Record` das listas do **contrato** (`THEME_COLOR_TOKENS` e
 * `FONT_ROLES`, via `@rv/contrato`) e não um objeto digitado aqui:
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

const DEFAULT_THEME = defaultTheme as ThemeFile

const DEFAULT_THEME_ID = DEFAULT_THEME.id

/**
 * Uma estação do payload virada `Theme`.
 *
 * O payload é **plano** — `{ id, enabled, position, type, label, colorRose,
 * colorDourado, fontDisplay, dateRangeStart, … }` —, porque a linha é uma
 * `content_section` com o `data` achatado (ver
 * `backend/src/modules/content/themes.ts`). Os nomes dos campos saem do
 * contrato (`themeColorField`/`themeFontField`), e não de uma lista digitada
 * aqui: uma cor nova no contrato chega sozinha.
 *
 * Campo ausente é "herda o padrão" — a estação declara só o que troca —, e é o
 * `normalizeTheme` abaixo que completa o que falta com o tema `default`.
 */
export function themeFromRow(row: unknown): Theme | null {
  const source = (row ?? {}) as Record<string, unknown>
  const id = typeof source.id === "string" ? source.id : ""

  if (!id) {
    return null
  }

  const colors: Partial<ThemeColors> = {}
  const fonts: Partial<ThemeFonts> = {}

  for (const token of THEME_COLOR_TOKENS) {
    const hex = source[themeColorField(token)]

    if (typeof hex === "string" && hex) {
      colors[token] = hex
    }
  }

  for (const role of FONT_ROLES) {
    const family = source[themeFontField(role)]

    if (typeof family === "string" && family) {
      fonts[role] = family
    }
  }

  const start =
    typeof source.dateRangeStart === "string" ? source.dateRangeStart : ""
  const end = typeof source.dateRangeEnd === "string" ? source.dateRangeEnd : ""

  return normalizeTheme({
    id,
    label: typeof source.label === "string" ? source.label : id,
    dateRange: start && end ? { start, end } : null,
    colors,
    fonts,
  })
}

/**
 * As estações do payload, prontas para `resolveTheme`.
 *
 * A linha que não é um tema é **descartada com log**, como o
 * `supportedSections` faz com a seção que a loja não conhece: a consulta pede
 * `surface=theme`, mas o que volta do banco é dado — e uma linha de outra
 * superfície (ou sem `id`) não pode virar paleta da loja. Sem tema nenhum, o
 * chamador cai no `default` embutido.
 */
export function themesFromRows(rows: unknown): Theme[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows
    .map((row) => {
      const type = (row as { type?: unknown } | null)?.type

      if (type !== undefined && type !== "theme") {
        console.error(
          `Tema com type "${String(type)}" não é um tema; descartado.`
        )
        return null
      }

      return themeFromRow(row)
    })
    .filter((theme): theme is Theme => theme !== null)
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
 * A lista vem do chamador — `lib/data/theme.ts` a monta do payload
 * (`themesFromRows`) e, quando a API falha, passa o `default` embutido. Assim
 * esta função continua pura: é a regra da janela, e não o I/O dela.
 *
 * When several seasonal ranges overlap, the narrowest window wins so a
 * short campaign (Black Friday) beats a broad season (Natal).
 * Always returns a usable theme thanks to the default fallback.
 */
export function resolveTheme(
  themes: readonly Theme[],
  date: Date = new Date()
): Theme {
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

/**
 * `getActiveTheme` mora em `lib/data/theme.ts` desde a R5: o tema ativo depende
 * do payload (`GET /store/content?surface=theme`), e ler dado é trabalho do
 * módulo de dados — aqui fica a **regra** (a janela mais estreita vence, o
 * `default` é o fallback), que é o que dá para testar sem servidor.
 */
