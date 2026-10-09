"use server"

import { sdk } from "@lib/config"
import { filtrarProdutos, construirFacetas, type Faceta, type SelecaoDoCatalogo } from "@lib/util/catalog-filters"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCatalogCacheOptions } from "./cookies"
import { CAMPOS_DO_CATALOGO } from "./product-fields"
import { getRegion, retrieveRegion } from "./regions"

/**
 * O teto de peças que uma página do catálogo carrega de uma vez.
 *
 * É o valor que o starter já usava para poder ordenar por preço em memória, e é o
 * limite honesto do desenho atual: acima disso a loja precisa de facetas no
 * servidor (o lugar delas é um `/store/products/facets`, não esta função).
 *
 * **Não é exportado, e isso não é estilo.** Este arquivo abre com `"use server"`,
 * e num módulo desses só pode sair **função async**: um número exportado daqui
 * derruba o `next build` inteiro na coleta de dados da primeira página que importa
 * o módulo. Quem precisa do teto o lê daqui — e quem duvidar dele encontra o
 * número nesta linha.
 */
const CATALOGO_LIMIT = 100


export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = await getCatalogCacheOptions("products")

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields: CAMPOS_DO_CATALOGO,
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * A página do catálogo: buscar, contar as facetas, filtrar, ordenar e cortar a
 * página — nesta ordem, e numa função só.
 *
 * Era "buscar 100 e ordenar" (o `sortProducts` existe porque a Store API não
 * ordena por preço). O redesenho pediu facetas, e as três que ele pede — tamanho,
 * cor e disponibilidade — **não existem como filtro na Store API**: o que existe é
 * `category_id`, `collection_id`, `q` e a ordem. Então o filtro acontece aqui, em
 * memória, sobre a mesma lista que a ordenação já usava — e é por isso que ele
 * mora nesta função, e não num componente: quem busca, conta, filtra, ordena e
 * pagina é **um lugar só**, e a tela recebe o resultado pronto.
 *
 * O `currencyCode` entra por parâmetro porque a faceta de faixa de preço escreve
 * dinheiro com a moeda da região — e quem já resolveu a região é quem chama
 * (a tela precisa dela de qualquer forma, para o preço de cada peça).
 *
 * O teto de 100 peças por requisição é o do starter, e é o limite honesto deste
 * desenho: uma loja que passe disso precisa de filtro no servidor (o lugar dele é
 * um `/store/products/facets`, não esta função). `catalogCount` devolve o tamanho
 * da prateleira inteira, e `count` o que sobrou depois dos filtros: são os dois
 * números que a tela precisa para distinguir "esta seleção está vazia" de
 * "nenhuma peça atende a estes filtros".
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  selecao = {},
  currencyCode = "brl",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  /** Os filtros marcados na URL (`?color=Preto&size=P`). */
  selecao?: SelecaoDoCatalogo
  /** A moeda da região — o rótulo da faceta de faixa de preço. */
  currencyCode?: string
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  facets: Faceta[]
  catalogCount: number
}> => {
  const limit = queryParams?.limit || 12

  const {
    response: { products: catalogo },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: CATALOGO_LIMIT,
    },
    countryCode,
  })

  const facets = construirFacetas(catalogo, { currencyCode, selecao })

  const filtrados = filtrarProdutos(catalogo, selecao)

  // A cópia é para o `sortProducts` — ele ordena no lugar e escreve `_minPrice`
  // nos produtos; a lista de onde as facetas saíram não pode mudar de ordem por
  // causa disso.
  const ordenados = sortProducts([...filtrados], sortBy)

  const inicio = (page - 1) * limit

  return {
    response: {
      products: ordenados.slice(inicio, inicio + limit),
      count: ordenados.length,
    },
    facets,
    catalogCount: catalogo.length,
  }
}

