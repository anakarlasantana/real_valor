import { Metadata } from "next"

import {
  DEFAULT_HOME_SECTIONS,
  type HomeSection,
} from "@lib/content/home-sections"
import { getHomeSections } from "@lib/data/content"
import { getRegion } from "@lib/data/regions"
import { ContentSectionList } from "@modules/content/render-section"
import { HttpTypes } from "@medusajs/types"

export const metadata: Metadata = {
  title: "A alfaiataria que valoriza você, não o seu status",
  description:
    "Alfaiataria feminina com qualidade que você sente e preços honestos para a sua realidade. Do PP ao GG, para todo o Brasil.",
}

/**
 * Home is rendered from the content payload, not from hard-coded JSX:
 * `getHomeSections()` returns an ordered list of typed sections and
 * `ContentSectionList` maps each one to its component.
 *
 * That indirection is the point of the CMS phase — when `/store/content`
 * starts returning admin-managed blocks, this file does not change at
 * all. `DEFAULT_HOME_SECTIONS` guarantees the storefront renders today,
 * before that endpoint exists.
 *
 * O `switch` de tipo → componente **saiu daqui** na F1 do doc 14: ele agora mora
 * em `@modules/content/render-section`, porque a mesma lista passou a ser
 * desenhada também pela rota `[slug]` (as páginas do CMS). Um registro copiado
 * nas duas pontas seria a lista de tipos com duas opiniões — o tipo renderizado
 * numa e não na outra só apareceria como HTTP 500 na página inteira. O **HTML
 * desta home não mudou**: o registro é o mesmo `switch`, com o mesmo embrulho de
 * âncora (`id` da seção + `rv-anchor` + variáveis de aparência).
 *
 * Only `hero`, `featured` and `launches` need commerce data (the current
 * region), which is why a missing region degrades those three sections
 * instead of failing the whole page.
 *
 * 60s, keyed by the `content` cache tag on the fetch itself: an admin
 * edit becomes visible within a minute, and `revalidateTag("content")`
 * can force it sooner.
 */
export const revalidate = 60

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  const { countryCode } = params

  let sections: HomeSection[] = DEFAULT_HOME_SECTIONS
  let region: HttpTypes.StoreRegion | null = null

  try {
    sections = await getHomeSections()
  } catch (error) {
    // `getHomeSections` already falls back internally; this guard keeps
    // the page resilient if that ever changes.
    console.error("Falha ao carregar as seções da home:", error)
  }

  try {
    region = (await getRegion(countryCode)) ?? null
  } catch (error) {
    console.error("Falha ao carregar a região:", error)
  }

  const rawFilter = searchParams?.peca
  const selectedFilter = Array.isArray(rawFilter) ? rawFilter[0] : rawFilter

  return (
    <ContentSectionList
      sections={sections}
      region={region}
      selectedFilter={selectedFilter}
    />
  )
}
