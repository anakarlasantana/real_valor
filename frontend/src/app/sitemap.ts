import type { MetadataRoute } from "next"

import { getLivePages } from "@lib/data/pages"
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
 * abre. Até o PR7 do doc 14 essa regra era aplicada **aqui**: o arquivo varria as
 * superfícies declaradas com uma requisição cada (`getPageSections`) e ficava com
 * a lista do que respondeu. Agora ela vem pronta do servidor
 * (`getLivePages` → `GET /store/content/pages`), que é o mesmo leitor da coluna
 * automática do rodapé, do índice público e da sugestão do 404 — uma régua, um
 * lugar e uma requisição em vez de seis.
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

  const pages = await getLivePages()

  return [
    { url: home, changeFrequency: "daily", priority: 1 },
    ...pages.map<MetadataRoute.Sitemap[number]>((page) => ({
      // `path` já vem no formato do conteúdo (`/sobre`), sem o país: quem o
      // prefixa é esta linha, que é quem sabe qual é o país do build.
      url: `${home}${page.path}`,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
  ]
}
