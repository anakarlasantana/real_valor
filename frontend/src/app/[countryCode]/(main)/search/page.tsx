import { Metadata } from "next"

import SearchTemplate from "@modules/search/templates"

/**
 * A busca da loja — `/search?q=…`, a rota que o ícone de lupa do cabeçalho
 * aponta (o destino vem do CMS, em `NavSection.actions`).
 *
 * A resolução do termo e da página mora **aqui**, e não no template, para
 * que o template receba dado limpo: um `?q=` só com espaços é a mesma
 * coisa que nenhum termo, e `?page=abc` (ou `0`, ou negativo) é a primeira
 * página. Sem essa normalização, o valor seguiria cru para a Store API, e
 * o que voltaria seria um erro do backend em vez de uma página.
 *
 * Não há `revalidate`: ao contrário das rotas de catálogo, o resultado
 * desta é função do termo digitado, que só existe em tempo de requisição.
 * Quem guarda o que pode ser guardado é o `listProducts`, que já busca com
 * cache (`getCatalogCacheOptions`).
 */
type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { q } = await props.searchParams
  const query = q?.trim()

  return {
    title: query ? `Buscar: ${query}` : "Buscar",
    description:
      "Encontre a sua peça no catálogo da Real Valor: busque por nome, cor ou ocasião.",
  }
}

export default async function SearchPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  const parsed = Number.parseInt(searchParams.page ?? "", 10)

  return (
    <SearchTemplate
      countryCode={params.countryCode}
      query={searchParams.q?.trim() ?? ""}
      page={Number.isFinite(parsed) && parsed > 0 ? parsed : 1}
    />
  )
}
