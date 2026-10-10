import type { MetadataRoute } from "next"

import { PAGE_SURFACES } from "@lib/content/home-sections"
import { getPageSections } from "@lib/data/content"
import { getBaseURL } from "@lib/util/env"

/**
 * O índice do site: a home e **as páginas que estão no ar**.
 * -------------------------------------------------------------------------
 * Antes da F1 do doc 14 não existia `sitemap.xml` nenhum: a loja pedia para a
 * busca adivinhar o que havia nela. O arquivo fecha o defeito 7 — a página passa
 * a ser **encontrável**, e não só existente.
 *
 * A regra de quem entra é a mesma do 404: **página sem bloco publicado responde
 * 404**, e anunciar um 404 no índice é o caminho mais curto para a busca
 * classificar o site como raso — além de a visitante clicar num resultado que não
 * abre. Por isso a lista é perguntada ao CMS (`getPageSections`, com a mesma tag
 * de cache e a mesma janela de 60s do resto da loja), e não montada do contrato
 * às cegas: o contrato diz que a página **pode** existir, o conteúdo diz se ela
 * existe hoje.
 *
 * O catálogo (produtos, categorias, coleções) fica para o RV-007, de propósito:
 * misturar as duas políticas num arquivo só faria a discussão do catálogo
 * (paginação, `lastmod`, canonical) parecer resolvida.
 */
export const revalidate = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseURL()
  // A loja é **localizada**: todo caminho tem o país no primeiro segmento (o
  // `middleware.ts` redireciona `/` para `/<país>`). O país do build é o mesmo
  // que o storefront usa como default em produção.
  const country = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"
  const home = `${base}/${country}`

  const pages = await Promise.all(
    PAGE_SURFACES.map(async (surface) => ({
      slug: surface.id,
      live: (await getPageSections(surface.id)).length > 0,
    }))
  )

  return [
    { url: home, changeFrequency: "daily", priority: 1 },
    ...pages
      .filter((page) => page.live)
      .map<MetadataRoute.Sitemap[number]>((page) => ({
        url: `${home}/${page.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      })),
  ]
}
