import type { MetadataRoute } from "next"

import {
  enderecoDaEntrada,
  gruposDoCatalogo,
  produtosDoCatalogo,
  type EntradaDoCatalogo,
} from "@lib/catalog/sitemap-catalog"
import { getLivePages } from "@lib/data/pages"
import { entradasDoCatalogo } from "@lib/data/products"
import { getBaseURL } from "@lib/medusa/env"

/**
 * O índice do site: home, páginas no ar e catálogo (RV-007) — só o que abre.
 */
export const revalidate = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseURL()
  // A loja é **localizada**: todo caminho tem o país no primeiro segmento (o
  // `middleware.ts` redireciona `/` para `/<país>`).
  const country = process.env.NEXT_PUBLIC_DEFAULT_REGION || "br"
  const home = `${base}/${country}`

  const [pages, catalogo] = await Promise.all([
    getLivePages(),
    entradasDoCatalogo({ countryCode: country }),
  ])

  const produtos = produtosDoCatalogo(catalogo.produtos)

  // Uma categoria só entra se alguma peça do catálogo a cita. Coleções não têm
  // lista de peças no payload (o produto guarda o `collection_id`), então toda
  // coleção publicada entra — ela é uma escolha da loja, e não um filtro.
  const categoriasComPeca = new Set(
    catalogo.produtos.flatMap((produto) =>
      (produto.categories ?? []).map((categoria) => categoria?.handle ?? "")
    )
  )

  const entradas: EntradaDoCatalogo[] = [
    ...produtos,
    ...gruposDoCatalogo("categories", catalogo.categorias, categoriasComPeca),
    ...gruposDoCatalogo(
      "collections",
      catalogo.colecoes,
      new Set(catalogo.colecoes.map((colecao) => colecao.handle ?? ""))
    ),
  ]

  return [
    { url: home, changeFrequency: "daily", priority: 1 },
    ...pages.map<MetadataRoute.Sitemap[number]>((page) => ({
      // `path` já vem no formato do conteúdo (`/sobre`), sem o país: quem o
      // prefixa é esta linha, que é quem sabe qual é o país do build.
      url: `${home}${page.path}`,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    ...entradas.map<MetadataRoute.Sitemap[number]>((entrada) => ({
      url: enderecoDaEntrada(base, country, entrada.path),
      lastModified: entrada.lastModified,
      changeFrequency: entrada.changeFrequency,
      priority: entrada.priority,
    })),
  ]
}
