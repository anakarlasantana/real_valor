import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import { abasDoCatalogo } from "@lib/util/category-tabs"
import { type SelecaoDoCatalogo } from "@lib/util/catalog-filters"
import CatalogSkeleton from "@modules/store/components/catalog-skeleton"
import CategoryTabs from "@modules/store/components/category-tabs"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

/**
 * O catálogo inteiro — "Todas as peças".
 *
 * A página são três faixas, como no redesenho: a **abertura** (a faixa elevada
 * com o título grande), as **abas de categoria** e o **miolo** (barra de
 * ferramentas, filtros e grade), que é a única parte que espera o backend e por
 * isso mora atrás de um `<Suspense>`.
 *
 * A cópia da abertura é a da referência — "Peças que vestem a sua essência" —, e
 * substituiu "Coleção / Todas as peças". A frase antiga nomeava a rota; a nova
 * diz o que a loja faz, que é o que uma capa de catálogo tem de fazer.
 *
 * As abas saem das categorias do backend (`listCategories`), e não de uma lista
 * no código: uma categoria nova no painel aparece aqui sem deploy. Quando a
 * chamada falha, `catch` devolve lista vazia e a barra de abas simplesmente não
 * existe (`CategoryTabs` não desenha uma barra de uma aba só) — o catálogo
 * continua inteiro, que é o que importa numa faixa decorativa.
 */
const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  selecao,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  selecao?: SelecaoDoCatalogo
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const categorias = await listCategories().catch(() => [])

  return (
    <main data-testid="category-container">
      <section className="rv-page-intro">
        <p className="rv-eyebrow text-rv-rose-strong">Real Valor</p>
        <h1>
          Peças que vestem <em>a sua essência.</em>
        </h1>
        <p>
          Design atemporal, caimento impecável e versatilidade para acompanhar
          todos os seus movimentos.
        </p>
      </section>

      <CategoryTabs items={abasDoCatalogo(categorias)} />

      <Suspense fallback={<CatalogSkeleton />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          selecao={selecao}
        />
      </Suspense>
    </main>
  )
}

export default StoreTemplate

