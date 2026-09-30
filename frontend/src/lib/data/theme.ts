"use server"

import { sdk } from "@lib/config"
import { resolveTheme, themesFromRows, type Theme } from "@lib/theme"

/**
 * Tag de cache do tema.
 *
 * A mesma do conteúdo (`lib/data/content.ts`): o tema é conteúdo como as
 * seções, na mesma tabela e na mesma superfície de edição, e uma gravação no
 * CRM avisa a loja com `revalidateTag("content")` (ver
 * `backend/src/modules/content/revalidate.ts`). Duas tags seriam duas
 * invalidações para a mesma edição — e a loja ficaria com a paleta velha por
 * até um minuto depois de o lojista salvar a cor.
 *
 * Não é exportada: num arquivo `"use server"` o Next só permite exportar
 * funções async.
 */
const CONTENT_CACHE_TAG = "content"

type ThemeResponse = {
  /**
   * As estações, **planas**: `{ id, enabled, position, type, label, colorRose,
   * …, dateRangeStart, dateRangeEnd }` — a linha de `content_section` com o
   * `data` no nível raiz, como em toda rota de conteúdo. Quem as vira `Theme` é
   * `themesFromRows` (`lib/theme.ts`), com os nomes de campo do contrato.
   */
  sections: unknown
  /** A versão do schema com que o tema foi gravado (mesma ideia do conteúdo). */
  schemaVersion: number
}

/**
 * O tema ativo da loja, lido do backend (`GET /store/content?surface=theme`).
 *
 * Só as estações **habilitadas** voltam da API (a rota pública filtra), e quem
 * escolhe entre elas é a data: a janela de `MM-DD` mais estreita vence
 * (`resolveTheme`, em `lib/theme.ts`).
 *
 * Uma falha aqui nunca derruba a loja: sem payload (API fora, banco vazio, a
 * superfície nunca semeada) a loja pinta com o **tema padrão embutido** — o
 * `themes/default/theme.json`, que está no bundle do build porque o
 * `lib/theme.ts` o importa. É o mesmo contrato do `getHomeSections`, que cai
 * nos `DEFAULT_HOME_SECTIONS`.
 */
export const getActiveTheme = async (): Promise<Theme> => {
  try {
    const { sections, schemaVersion } = await sdk.client.fetch<ThemeResponse>(
      "/store/content",
      {
        method: "GET",
        query: { surface: "theme" },
        // A mesma janela e a mesma tag do conteúdo: o tema é conteúdo.
        next: { tags: [CONTENT_CACHE_TAG], revalidate: 60 },
        cache: "force-cache",
      }
    )
    const themes = themesFromRows(sections)

    if (!themes.length) {
      // Vazio é sinal de que o seed do tema não rodou (ou de que todas as
      // estações estão desligadas no CRM) — não de que o tema é "nenhum".
      console.error(
        `A superfície de tema não devolveu nenhuma estação (schema ` +
          `v${schemaVersion}); a loja pinta com o tema padrão embutido.`
      )
    }

    return resolveTheme(themes)
  } catch (error) {
    console.error("Falha ao carregar o tema da loja:", error)

    return resolveTheme([])
  }
}
