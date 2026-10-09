import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"

import SearchEmpty from "../components/search-empty"

/**
 * As peças que a busca encontrou — o miolo de dados da página.
 *
 * Ele é o irmão de `store/templates/paginated-products.tsx`, com uma
 * diferença que é o assunto desta tela: o filtro é o termo (`q`). Nada
 * mais aqui é novo — a grade, o card e a paginação são os mesmos do
 * catálogo, e têm de ser: a peça encontrada pela busca é a mesma peça que
 * a vitrine mostra, com o mesmo preço, o mesmo chip de estado e a mesma
 * foto. Duas versões de card seriam duas verdades sobre a mesma peça.
 *
 * O `q` vai direto para a Store API, que procura no título, na descrição
 * e no handle do produto — é o backend que sabe procurar, e reimplementar
 * isso aqui (filtrando uma lista já baixada) só daria o mesmo resultado
 * enquanto o catálogo coubesse numa página.
 *
 * O `page` chega já validado pela rota, mas há um caso em que ele pode
 * apontar para fora do resultado — uma URL montada à mão, `?q=blazer&page=99`.
 * Nesse caso o bloco continua de pé (a contagem e a paginação aparecem, e a
 * cliente volta para a primeira página pelo controle); o que **não** se faz
 * é dizer "nada encontrado", porque aí não é a busca que falhou.
 */
export const SEARCH_LIMIT = 12

export default async function SearchResults({
  query,
  page,
  countryCode,
}: {
  query: string
  page: number
  countryCode: string
}) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: page,
    queryParams: { q: query, limit: SEARCH_LIMIT },
    countryCode,
  })

  if (count === 0) {
    return <SearchEmpty query={query} />
  }

  const totalPages = Math.ceil(count / SEARCH_LIMIT)

  return (
    <div className="rv-page-pad">
      <div className="rv-container">
        {/*
          A contagem é a primeira linha do resultado, e ela é uma frase, não
          um número solto: "1 peça" e "2 peças" não se escrevem com o mesmo
          plural — e "1 peças" é o tipo de detalhe que faz uma loja parecer
          descuidada justamente quando ela acertou.
        */}
        <p
          className="rv-eyebrow text-rv-muted"
          data-testid="search-count"
          role="status"
        >
          {count === 1 ? "1 peça encontrada" : `${count} peças encontradas`}
        </p>

        {products.length > 0 && (
          <ul
            className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 small:grid-cols-3 medium:grid-cols-4"
            data-testid="products-list"
          >
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} />
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
  )
}
