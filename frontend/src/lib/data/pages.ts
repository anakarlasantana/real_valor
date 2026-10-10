"use server"

import { CONTENT_CACHE_TAG, CONTENT_CACHE_WINDOW } from "@lib/content/cache"
import { sdk } from "@lib/config"

/**
 * As páginas que estão **no ar** — o leitor público do índice das páginas.
 * -------------------------------------------------------------------------
 * Responde `GET /store/content/pages`: as páginas declaradas que a loja responde
 * 200, com rótulo e endereço, numa chamada só. Quatro pontas fazem essa mesma
 * pergunta, e todas leem daqui:
 *
 *   - o `sitemap` (`app/sitemap.ts`), que antes varria as seis superfícies com
 *     seis requisições;
 *   - a coluna do rodapé com `source: "pages"` (a automática, do PR7 do doc 14);
 *   - o índice público (`/paginas`);
 *   - a sugestão do 404 (`(main)/not-found.tsx`).
 *
 * A régua **não** é daqui: quem decide o que está no ar é o servidor
 * (`publishedSections` + `pageState`, no contrato — a mesma que a rota `[slug]`
 * aplica antes do `notFound()`). A loja não conta bloco nenhum, e é isso que
 * impede o rodapé de prometer um endereço que responde 404.
 *
 * A falha de rede devolve lista vazia, e não a lista do contrato: vazio esconde a
 * coluna, o índice diz que não há nada e o 404 não sugere — as três são verdades
 * possíveis; anunciar uma página que não abre não é.
 */
export type LivePage = {
  /** O `id` da superfície, que é o slug da URL. */
  id: string
  /** O rótulo da superfície — o nome que a lojista deu à página. */
  label: string
  /** O endereço na loja (`/sobre`), sem o país: quem prefixa é o `nav-link`. */
  path: string
}

type PagesResponse = {
  pages: LivePage[]
  schemaVersion: number
}

export const getLivePages = async (): Promise<LivePage[]> => {
  try {
    const { pages } = await sdk.client.fetch<PagesResponse>(
      "/store/content/pages",
      {
        method: "GET",
        // A mesma tag e a mesma janela do resto do conteúdo (ver
        // `lib/content/cache.ts`): uma gravação no CRM invalida as duas leituras,
        // e o pior caso é o minuto prometido.
        next: { tags: [CONTENT_CACHE_TAG], revalidate: CONTENT_CACHE_WINDOW },
        cache: "force-cache",
      }
    )

    // O que chega é dado de rede: lista ausente ou de outro tipo conta como
    // vazio, em vez de virar erro no render do rodapé — que aparece em todas as
    // rotas.
    return Array.isArray(pages) ? pages : []
  } catch (error) {
    console.error("Falha ao carregar as páginas do site:", error)

    return []
  }
}
