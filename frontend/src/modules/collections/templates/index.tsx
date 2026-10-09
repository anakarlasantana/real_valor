import { Suspense } from "react"

import { type SelecaoDoCatalogo } from "@lib/util/catalog-filters"
import { HttpTypes } from "@medusajs/types"
import CatalogSkeleton from "@modules/store/components/catalog-skeleton"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"

/**
 * A página de uma coleção — a mesma prateleira do catálogo, com o recorte de uma
 * coleção curada.
 *
 * Ela **não** tem barra de abas, e isso é decisão: uma coleção não é uma árvore
 * de categorias (é uma lista de peças escolhidas), então aba nenhuma diria para
 * onde ir. O que ela tem é o mesmo miolo do catálogo — filtros, ordem, grade e
 * paginação —, porque a peça numa coleção é a mesma peça, com as mesmas opções
 * para escolher.
 */
export default function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  selecao,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  selecao?: SelecaoDoCatalogo
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <main>
      <section className="rv-page-intro">
        <p className="rv-eyebrow text-rv-rose-strong">Coleção</p>
        <h1>{collection.title}</h1>
      </section>

      <Suspense fallback={<CatalogSkeleton />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          collectionId={collection.id}
          countryCode={countryCode}
          selecao={selecao}
        />
      </Suspense>
    </main>
  )
}

