import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle } from "@lib/data/categories"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
}

/**
 * Teto de revalidacao do segmento (1h).
 *
 * Nao existe `generateStaticParams()` aqui de proposito. Ele chamava a Store API
 * (`listCategories` e `listRegions`) durante o `next build`, o que quebrava o
 * build da imagem: sem um backend Medusa no ar o `docker compose build frontend`
 * abortava com
 *   "Failed to collect page data for /[countryCode]/categories/[...category]"
 * (e exigia anexar o builder a `real_valor_net`, opcao `network` que o BuildKit
 * nao suporta). A lista de categorias muda em runtime, nao no build: pre-render
 * so serve envelhecido. Sem o `generateStaticParams` a rota passa a ser resolvida
 * sob demanda e o build nao precisa de rede.
 *
 * A invalidacao sob demanda e feita por `POST /api/revalidate`:
 *   `?tag=categories` ou `?route=/[countryCode]/(main)/categories/[...category]&type=page`.
 */
export const revalidate = 3600

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    const title = productCategory.name + " | Medusa Store"

    const description = productCategory.description ?? `${title} category.`

    return {
      title: `${title} | Medusa Store`,
      description,
      alternates: {
        canonical: `${params.category.join("/")}`,
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  return (
    <CategoryTemplate
      category={productCategory}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
    />
  )
}
