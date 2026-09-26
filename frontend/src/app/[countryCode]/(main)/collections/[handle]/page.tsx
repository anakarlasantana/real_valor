import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCollectionByHandle } from "@lib/data/collections"
import { StoreCollection } from "@medusajs/types"
import CollectionTemplate from "@modules/collections/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<{
    page?: string
    sortBy?: SortOptions
  }>
}

export const PRODUCT_LIMIT = 12

/**
 * Teto de revalidacao do segmento (1h).
 *
 * O `generateStaticParams()` foi removido: ele chamava `listCollections` e
 * `listRegions` durante o `next build`, obrigando o builder a alcancar um
 * backend Medusa (sem ele o build aborta com "Failed to collect page data for
 * /[countryCode]/collections/[handle]"). Colecoes sao dados de runtime — a rota
 * e resolvida sob demanda e o build nao depende de rede.
 *
 * Invalidacao sob demanda: `POST /api/revalidate?tag=collections` ou
 * `?route=/[countryCode]/(main)/collections/[handle]&type=page`.
 */
export const revalidate = 3600

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const collection = await getCollectionByHandle(params.handle)

  if (!collection) {
    notFound()
  }

  const metadata = {
    title: `${collection.title} | Medusa Store`,
    description: `${collection.title} collection`,
  } as Metadata

  return metadata
}

export default async function CollectionPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams

  const collection = await getCollectionByHandle(params.handle).then(
    (collection: StoreCollection) => collection
  )

  if (!collection) {
    notFound()
  }

  return (
    <CollectionTemplate
      collection={collection}
      page={page}
      sortBy={sortBy}
      countryCode={params.countryCode}
    />
  )
}
