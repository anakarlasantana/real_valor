import type { FontRole, ThemeColorToken } from "./contract"

/**
 * O tema da loja — o padrão e as estações.
 * -----------------------------------------------------------------
 * Este arquivo é a **única cópia** da paleta sazonal e das janelas de data da
 * loja (até a R3-lite elas existiam só como `frontend/themes/<id>/theme.json`,
 * digitadas à mão, fora de qualquer tipo).
 *
 * A paleta do **tema padrão** não está aqui: ela é `THEME_COLOR_HEXES` do
 * contrato — o mesmo dado que o CRM usa para desenhar a bolinha de cor da
 * prévia —, e o gerador é quem a escreve no `theme.json`. Aqui só entra o que
 * muda por estação, e só o que muda de verdade (o Natal troca três cores): cor
 * ou fonte ausente é **herdada** do padrão, pelo `normalizeTheme` de
 * `frontend/src/lib/theme.ts`.
 *
 * O import do contrato é **de tipo** (`import type`): o gerador carrega este
 * módulo num processo Node que resolve ESM, onde um import sem extensão
 * (`./contract`) não resolveria. Tipo é apagado no carregamento — o valor
 * nunca é buscado —, e quem junta as duas metades (a paleta do contrato e as
 * estações daqui) é o gerador, no único lugar em que as duas se encontram.
 *
 * Usado por três caminhos, como `DEFAULT_HOME_SECTIONS` em `./defaults`:
 *
 *   1. `scripts/gen-content.mjs` escreve `frontend/themes/<id>/theme.json` —
 *      o **seed** que a loja lê hoje (até a R5 ler o payload) e que a R4 vai
 *      levar para o banco como uma linha de `content_section` na superfície
 *      `theme`. O arquivo é gerado, e não digitado: o `--check` do gerador
 *      roda no `make check` e no hook de commit, então o seed não envelhece
 *      em silêncio;
 *   2. a R4 (`seed` do tema na linha do banco) — a mesma lista, já tipada;
 *   3. o fallback do storefront quando a API de conteúdo falhar: `theme.ts`
 *      cai no `themes/default/theme.json`, que sai daqui.
 *
 * A janela de data é `MM-DD`, sem ano: ela é **anual** de propósito (o Verão
 * vira o ano), e quem decide o que fazer quando `start > end` é o
 * `resolveTheme`. Quando duas janelas se sobrepõem, a **mais estreita**
 * vence — é assim que a Black Friday (11 dias) ganha do Natal (42), sem
 * nenhuma regra de prioridade para alguém esquecer de manter.
 */

/** Uma estação, no formato do `theme.json` que o storefront lê. */
export type ThemeFile = {
  id: string
  /** Como a estação aparece no CRM. A loja não mostra. */
  label: string
  /** `MM-DD`; `null` significa "sempre disponível" (só o padrão). */
  dateRange: { start: string; end: string } | null
  /** Só o que a estação troca. Ausente é herdado do tema padrão. */
  colors: Partial<Record<ThemeColorToken, string>>
  /** Idem: papel de fonte ausente é o do tema padrão. */
  fonts: Partial<Record<FontRole, string>>
}

/**
 * O que toda estação declara: id, rótulo e a janela de data.
 *
 * O padrão para aqui (`ThemeBase`) porque ele não troca nada — a paleta e as
 * famílias dele **são** as do contrato, e quem as escreve no `theme.json` é o
 * gerador. As estações acrescentam os `colors`/`fonts` que mudam (`ThemeFile`).
 */
export type ThemeBase = Pick<ThemeFile, "id" | "label" | "dateRange">

/**
 * O tema padrão: a base de que toda estação herda e o fallback da loja.
 *
 * `dateRange: null` porque ele não é uma estação — é o que fica no ar quando
 * nenhuma janela casa, e é por isso que o `resolveTheme` não o descarta (as
 * outras precisam de uma janela para concorrer).
 */
export const THEME_DEFAULT: ThemeBase = {
  id: "default",
  label: "Real Valor",
  dateRange: null,
}

/**
 * As estações, na ordem em que os arquivos de seed são escritos.
 *
 * A ordem **não** é a prioridade (quem decide é o tamanho da janela); ela só
 * torna o `--check` do gerador determinístico, para o seed não aparecer
 * reordenado a cada `make gen`.
 */
export const THEME_SEASONS: readonly ThemeFile[] = [
  {
    id: "black-friday",
    label: "Black Friday",
    dateRange: { start: "11-20", end: "11-30" },
    colors: {
      rose: "#B97872",
      offwhite: "#F4F2F0",
      cacao: "#2A2626",
      preto: "#0F0F0F",
      dourado: "#C9A187",
    },
    fonts: {},
  },
  {
    id: "natal",
    label: "Natal",
    dateRange: { start: "11-15", end: "12-26" },
    colors: {
      rose: "#8E3B3B",
      offwhite: "#FAF5EF",
      dourado: "#D8B26A",
    },
    fonts: {},
  },
  {
    id: "verao",
    label: "Verão",
    dateRange: { start: "12-27", end: "03-20" },
    colors: {
      rose: "#C98A7D",
      offwhite: "#FBF6EE",
      dourado: "#DCC0A6",
    },
    fonts: {},
  },
]

