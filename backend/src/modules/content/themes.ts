import {
  FONT_ROLES,
  THEME_COLOR_HEXES,
  THEME_FONTS,
  THEME_SURFACE,
  THEME_TYPE,
  themeColorField,
  themeFontField,
  type FontRole,
  type ThemeColorToken,
} from "./contract"

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
 * O import do contrato é **de valor** desde a R4. Até a R3-lite era só de tipo,
 * porque o gerador carrega este módulo num processo Node que resolve ESM e um
 * import sem extensão (`./contract`) não resolvia — medido: `ERR_MODULE_NOT_FOUND`.
 * O sintoma era o do Node, não do contrato: desde o 22 ele apaga os tipos
 * nativamente, e só faltava a resolução do especificador. O carregador do
 * gerador (`scripts/lib/load-export.mjs`) passou a registrar um hook de
 * resolução de 10 linhas, e agora a paleta do contrato e as estações daqui se
 * encontram **aqui**, no único lugar em que as duas existem: o gerador e o seed
 * do banco consomem o mesmo objeto (`THEME_FILES`), e não há merge paralelo
 * para divergir.
 *
 * Usado por três caminhos, como `DEFAULT_HOME_SECTIONS` em `./defaults`:
 *
 *   1. `scripts/gen-content.mjs` escreve `frontend/themes/<id>/theme.json` daqui
 *      — o **seed** que o gerador versiona. O arquivo é gerado, e não digitado:
 *      o `--check` do gerador roda no `make check` e no hook de commit, então o
 *      seed não envelhece em silêncio;
 *   2. `THEME_SECTIONS` (abaixo) — as linhas de `content_section` da superfície
 *      `theme`, semeadas pelo `make seed` e pelo "Restaurar padrão" da aba do
 *      tema no CRM (R4). É a mesma lista, já achatada no formato do `data`;
 *   3. o fallback do storefront quando a API de conteúdo falhar: `theme.ts` cai
 *      no `themes/default/theme.json`, que sai daqui.
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

/**
 * O tema padrão **completo**: id, rótulo, janela (nenhuma) e a paleta/fontes
 * do contrato, já fundidas.
 *
 * É o único `ThemeFile` com tudo preenchido — as estações declaram só o que
 * trocam e o resto é herdado deste. Até a R4 esta junção era feita pelo
 * gerador (o contrato tinha a paleta, este arquivo tinha as estações, e o
 * único lugar em que as duas se encontravam era o `gen-content.mjs`); agora ela
 * mora no módulo dono das duas metades, e serve às duas portas: o gerador
 * escreve os `theme.json` daqui e o seed grava as linhas do banco daqui.
 */
export const THEME_FILES: readonly ThemeFile[] = [
  {
    ...THEME_DEFAULT,
    colors: THEME_COLOR_HEXES,
    fonts: Object.fromEntries(
      FONT_ROLES.map((role) => [role, THEME_FONTS[role].family])
    ),
  },
  ...THEME_SEASONS,
]

/**
 * O `data` de uma linha de estação: o `ThemeFile` **achatado** — um campo por
 * cor e por papel de fonte, com os nomes que o contrato publica
 * (`themeColorField`/`themeFontField`).
 *
 * Chave de valor vazio **não se escreve**: em branco significa "herda o tema
 * padrão", e gravar `""` seria dizer à loja que a estação tem uma cor que não é
 * cor nenhuma. É o mesmo contrato do `theme.json` (o Natal troca três cores) e
 * o motivo de a leitura da loja mesclar o que vem sobre o padrão.
 */
function themeData(theme: ThemeFile): Record<string, unknown> {
  const data: Record<string, unknown> = { label: theme.label }

  if (theme.dateRange) {
    data.dateRangeStart = theme.dateRange.start
    data.dateRangeEnd = theme.dateRange.end
  }

  for (const [token, hex] of Object.entries(theme.colors)) {
    if (hex) {
      data[themeColorField(token as ThemeColorToken)] = hex
    }
  }

  for (const [role, family] of Object.entries(theme.fonts)) {
    if (family) {
      data[themeFontField(role as FontRole)] = family
    }
  }

  return data
}

/** Uma linha do conteúdo padrão: colunas de controle e o `data` achatado. */
export type ThemeSection = {
  id: string
  type: string
  enabled: boolean
  position: number
  [key: string]: unknown
}

/**
 * As estações como **conteúdo padrão da superfície `theme`** — o que o
 * `make seed` cria e o que o botão "Restaurar padrão" da aba do tema repõe.
 *
 * Tem a mesma forma de `DEFAULT_HOME_SECTIONS` (`./defaults`): `id`, `type`,
 * `enabled`, `position` e o resto achatado no nível raiz. É essa forma que
 * `restoreDefaultSections` consome, então as duas superfícies passam pela mesma
 * máquina — a única diferença entre elas é a lista.
 *
 * `position` é a ordem da lista (10, 20, 30…), como no padrão da vitrine: o
 * padrão é a numeração inicial, e quem manda depois é a coluna do banco.
 */
export const THEME_SECTIONS: readonly ThemeSection[] = THEME_FILES.map(
  (theme, index) => ({
    id: theme.id,
    type: THEME_TYPE,
    enabled: true,
    position: (index + 1) * 10,
    ...themeData(theme),
  })
)

