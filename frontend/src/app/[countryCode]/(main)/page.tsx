import { Metadata } from "next"

import {
  DEFAULT_HOME_SECTIONS,
  type HomeSection,
} from "@lib/content/home-sections"
import { getHomeSections } from "@lib/data/content"
import { getRegion } from "@lib/data/regions"
import BenefitsBar from "@modules/home/components/benefits-bar"
import CollectionHighlights from "@modules/home/components/collection-highlights"
import EditorialBanner from "@modules/home/components/editorial-banner"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import InstagramGrid from "@modules/home/components/instagram-grid"
import { HttpTypes } from "@medusajs/types"
import { type ReactNode } from "react"

export const metadata: Metadata = {
  title: "A alfaiataria que valoriza você, não o seu status",
  description:
    "Alfaiataria feminina com qualidade que você sente e preços honestos para a sua realidade. Do PP ao GG, para todo o Brasil.",
}

/**
 * Home is rendered from the content payload, not from hard-coded JSX:
 * `getHomeSections()` returns an ordered list of typed sections and this
 * page maps each one to its component.
 *
 * That indirection is the point of the CMS phase — when `/store/content`
 * starts returning admin-managed blocks, this file does not change at
 * all. `DEFAULT_HOME_SECTIONS` guarantees the storefront renders today,
 * before that endpoint exists.
 *
 * Each rendered section is also wrapped in an element carrying the
 * section `id`: that id is the scroll anchor the header menu points at
 * (`/#editorial` is the "Sobre" item), so the wrapper has to exist for
 * every section — see `renderSection`.
 *
 * Only `hero` and `featured` need commerce data (the current region),
 * which is why a missing region degrades those two sections instead of
 * failing the whole page.
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
    <>
      {sections.map((section) => {
        const body = renderSection(section, region, selectedFilter)

        // Seção sem corpo (chrome do site, ou `featured` sem região) não
        // vira âncora vazia no meio da página.
        if (!body) {
          return null
        }

        // O `id` da seção no CMS **é** a âncora do menu: o `/#editorial`
        // do item "Sobre", por exemplo, é resolvido por
        // `getElementById("editorial")`. Fica aqui, e não em cada
        // componente, para que toda seção — inclusive as que ainda não
        // existem — seja um alvo válido sem depender de alguém lembrar de
        // repetir o id no JSX. `.rv-anchor` (brand.css) compensa o
        // cabeçalho fixo.
        return (
          <div key={section.id} id={section.id} className="rv-anchor">
            {body}
          </div>
        )
      })}
    </>
  )
}

/**
 * The registry. Switching on `section.type` gives real exhaustiveness:
 * `assertNever` stops compiling if a member is added to the
 * `HomeSection` union and not handled here.
 *
 * `announcement` e `nav` viajam no mesmo payload, mas não são seções da
 * home: são chrome do site, resolvidos pelo layout (barra superior e
 * cabeçalho). Por isso os dois caem em `null` aqui — devolver os dois
 * duplicaria a barra e o cabeçalho no corpo da página.
 *
 * Devolve `null` (em vez de JSX) para que o chamador consiga distinguir
 * "nada a renderizar" de "seção renderizada" e só embrulhar a segunda na
 * âncora.
 */
function renderSection(
  section: HomeSection,
  region: HttpTypes.StoreRegion | null,
  selectedFilter?: string
): ReactNode {
  switch (section.type) {
    case "announcement":
      // Rendered by the layout as site chrome, so it is skipped here to
      // avoid duplicating the bar on the page.
      return null
    case "nav":
      // Mesmo caso da barra de anúncio: o layout resolve o cabeçalho via
      // `headerSections()` e o desenha fora da página.
      return null
    case "hero":
      return <Hero section={section} />
    case "benefits":
      return <BenefitsBar items={section.items} />
    case "collections":
      return <CollectionHighlights section={section} />
    case "featured":
      if (!region) {
        return null
      }
      return (
        <FeaturedProducts
          section={section}
          region={region}
          selectedFilter={selectedFilter}
        />
      )
    case "editorial":
      return <EditorialBanner section={section} />
    case "instagram":
      return <InstagramGrid section={section} />
    default:
      return assertNever(section)
  }
}

function assertNever(value: never): never {
  throw new Error(
    `Seção de home não suportada: ${JSON.stringify(
      (value as { type?: string })?.type
    )}`
  )
}
