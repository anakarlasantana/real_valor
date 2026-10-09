import { Tag } from "@medusajs/icons"

import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import {
  CHAVES_DE_FACETA,
  type SelecaoDoCatalogo,
} from "@lib/util/catalog-filters"
import { chipsDaSelecao } from "@lib/util/filter-chips"
import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

import CatalogToolbar from "../components/catalog-toolbar"
import ClearFilters from "../components/clear-filters"
import FilterChips from "../components/filter-chips"
import FilterPanel from "../components/filter-panel"
import { Pagination } from "../components/pagination"
import { SortOptions } from "../components/refinement-list/sort-products"

/**
 * A página do catálogo — a moldura em volta do que `listProductsWithSort`
 * devolve: barra de ferramentas, filtros, grade e paginação.
 *
 * **Quem busca, conta, filtra, ordena e pagina é a função de dados**
 * (`lib/data/products.ts`); aqui só se desenha o resultado. Foi assim que este
 * arquivo ficou: ele repetia a mecânica de busca e corte de página que já existia
 * na função ao lado, e duas cópias da mesma mecânica divergem no primeiro ajuste.
 *
 * Os três vazios são diferentes de propósito:
 *
 *   - **prateleira vazia** (`catalogCount === 0`, o backend não devolveu peça
 *     nenhuma): a seleção não tem nada, e o convite é o catálogo inteiro;
 *   - **filtros sem resultado** (`count === 0` com prateleira cheia): há catálogo,
 *     mas a combinação marcada não o alcança — o caminho de volta é limpar;
 *   - **página fora do intervalo** (uma URL montada à mão, `?page=99`): não é erro
 *     nenhum e não vira aviso; a grade fica vazia e a paginação continua ali para
 *     voltar.
 */
const PRODUCT_LIMIT = 12

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  selecao = {},
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  selecao?: SelecaoDoCatalogo
}) {
  const queryParams: PaginatedProductsParams = {
    limit: PRODUCT_LIMIT,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products, count },
    facets,
    catalogCount,
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    selecao,
    currencyCode: region.currency_code,
    countryCode,
  })

  if (catalogCount === 0) {
    return (
      <div className="rv-catalog-pad">
        <div className="rv-container">
          <EmptyState
            icon={<Tag aria-hidden="true" focusable="false" />}
            title="Esta prateleira ainda está vazia"
            text="As peças desta seleção estão a caminho. Enquanto isso, veja tudo o que já está no ar."
            data-testid="catalog-empty-state"
          >
            <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
              Ver todas as peças
            </LocalizedClientLink>
          </EmptyState>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  // Quantos valores estão marcados, somando as facetas — o número do botão
  // "Filtros (n)" no celular, onde a barra lateral não está à vista.
  const ativos = CHAVES_DE_FACETA.reduce(
    (total, chave) => total + (selecao[chave]?.length ?? 0),
    0
  )

  return (
    <div className="rv-catalog-pad">
      <div className="rv-container">
        <CatalogToolbar
          count={count}
          sortBy={sortBy ?? "created_at"}
          facets={facets}
          ativos={ativos}
        />

        {/*
          Os filtros aplicados, em chips — logo abaixo da barra de ferramentas e
          **acima** da grade: é a resposta curta para "por que esta grade tem 4
          peças?", e no celular é a única coisa que lembra a cliente do que ela
          marcou (a barra lateral não existe lá). Sem filtro não há fileira: o
          componente devolve `null` com a lista vazia.
        */}
        <FilterChips chips={chipsDaSelecao(facets, selecao)} />

        <div className="rv-catalog-layout">
          {/* A barra lateral é do desktop; no celular os mesmos filtros vão
              para a gaveta (o botão está na barra de ferramentas). As duas
              instâncias leem a mesma URL — não há estado para sincronizar. */}
          {facets.length > 0 && (
            <aside
              className="rv-catalog-filters hidden small:block"
              data-testid="catalog-filters"
              aria-label="Filtrar produtos"
            >
              <p className="rv-eyebrow text-rv-muted">Filtrar por</p>
              <FilterPanel facets={facets} />
            </aside>
          )}

          <div>
            {count === 0 ? (
              <EmptyState
                icon={<Tag aria-hidden="true" focusable="false" />}
                title="Nenhuma peça com esses filtros"
                text="A combinação marcada não encontra nenhuma peça neste catálogo. Tente uma opção a menos."
                data-testid="catalog-empty-state"
              >
                <ClearFilters />
              </EmptyState>
            ) : (
              <ul className="rv-catalog-grid" data-testid="products-list">
                {products.map((produto) => (
                  <li key={produto.id}>
                    <ProductPreview product={produto} region={region} />
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <Pagination
                data-testid="product-pagination"
                page={page}
                totalPages={totalPages}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
}
