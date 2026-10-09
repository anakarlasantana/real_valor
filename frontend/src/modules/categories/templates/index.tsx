import { notFound } from "next/navigation"
import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import { abasDoCatalogo } from "@lib/util/category-tabs"
import { type SelecaoDoCatalogo } from "@lib/util/catalog-filters"
import { HttpTypes } from "@medusajs/types"
import Breadcrumb, {
  type ItemDoCaminho,
} from "@modules/common/components/breadcrumb"
import CatalogSkeleton from "@modules/store/components/catalog-skeleton"
import CategoryTabs from "@modules/store/components/category-tabs"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"

/**
 * A página de uma categoria — a mesma prateleira do catálogo, com o recorte.
 *
 * Ela deixou de ser "um título e uma grade" e passou a ser a mesma página do
 * catálogo, com três trocas de conteúdo: o caminho de volta (o breadcrumb, que só
 * existe quando a categoria tem mãe), o título (o nome da categoria, no lugar da
 * frase da capa) e a descrição, quando o lojista a escreveu.
 *
 * A aba acesa é a categoria atual — e é por isso que a lista de abas vem das
 * categorias **do backend** somadas às filhas desta (`abasDoCatalogo`): na barra,
 * ela e as irmãs ficam lado a lado, e descer um nível é um clique.
 *
 * A barra de abas é decorativa e a página não depende dela: se `listCategories`
 * falhar, `catch` devolve lista vazia, a barra não é desenhada (uma aba só não é
 * uma barra) e a grade — que é o motivo de a página existir — continua inteira.
 */
export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  selecao,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  selecao?: SelecaoDoCatalogo
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  const categorias = await listCategories().catch(() => [])

  const caminho: ItemDoCaminho[] = [
    { label: "Início", href: "/" },
    ...parents.map((parent) => ({
      label: parent.name,
      href: `/categories/${parent.handle}`,
    })),
    { label: category.name },
  ]

  return (
    <main data-testid="category-container">
      <section className="rv-page-intro">
        <Breadcrumb items={caminho} className="mb-6" />

        <p className="rv-eyebrow text-rv-rose-strong">Categoria</p>
        <h1>{category.name}</h1>

        {category.description && <p>{category.description}</p>}
      </section>

      <CategoryTabs
        items={abasDoCatalogo(categorias, category)}
        activeHandle={category.handle}
      />

      <Suspense fallback={<CatalogSkeleton />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          categoryId={category.id}
          countryCode={countryCode}
          selecao={selecao}
        />
      </Suspense>
    </main>
  )
}

