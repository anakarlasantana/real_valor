"use server"

import { sdk } from "@lib/config"
import {
  DEFAULT_HOME_SECTIONS,
  visibleSections,
  type HomeSection,
} from "@lib/content/home-sections"

/**
 * Tag de cache do conteúdo.
 *
 * Passada direto (não via `getCacheOptions`), que prefixa a tag com um
 * id de visitante por cookie. O conteúdo é igual para todo mundo, então
 * uma tag global é mais útil: `revalidateTag("content")` invalida de
 * uma vez, e não só a sessão que editou.
 *
 * Não é exportada: num arquivo `"use server"` o Next só permite
 * exportar funções async, e uma constante quebraria o build.
 */
const CONTENT_CACHE_TAG = "content"

type ContentResponse = {
  sections: HomeSection[]
}

/**
 * Reads the home content from the backend Content module
 * (`GET /store/content`).
 *
 * The contract and the defaults live in `lib/content/home-sections.ts`,
 * which mirrors `backend/src/modules/content/contract.ts`. A parity
 * test in `lib/content/__tests__/contract-parity.test.ts` fails if the
 * two drift apart.
 *
 * A content failure must never take the storefront down, so every
 * error path falls back to `DEFAULT_HOME_SECTIONS`.
 */
export const getHomeSections = async (): Promise<HomeSection[]> => {
  try {
    const { sections } = await sdk.client.fetch<ContentResponse>(
      "/store/content",
      {
        method: "GET",
        query: { surface: "home" },
        next: { tags: [CONTENT_CACHE_TAG] },
        cache: "force-cache",
      }
    )

    // Empty is valid configuration (the admin hid everything), but it is
    // far more often a sign the seed never ran — use the defaults then.
    if (!sections?.length) {
      return visibleSections(DEFAULT_HOME_SECTIONS)
    }

    return visibleSections(sections)
  } catch (error) {
    // A content failure must never take the storefront down: the home
    // still renders with the baked-in defaults.
    console.error("Falha ao carregar o conteúdo da home:", error)

    return visibleSections(DEFAULT_HOME_SECTIONS)
  }
}

