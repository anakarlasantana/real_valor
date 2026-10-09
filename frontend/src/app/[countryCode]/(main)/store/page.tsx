import { Metadata } from "next"

import { selecaoDaUrl } from "@lib/util/catalog-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Todas as peças",
  description: "Veja todas as peças do nosso catálogo.",
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      /*
       * Os filtros são lidos da URL **aqui**, e não dentro do template: quem sabe
       * o que chegou no endereço é a rota, e o que desce para a árvore é um objeto
       * já limpo (`?cor=&page=` viram ausência, e não string vazia).
       */
      selecao={selecaoDaUrl(searchParams)}
    />
  )
}
