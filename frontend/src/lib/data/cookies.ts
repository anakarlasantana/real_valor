import "server-only"
import { cookies as nextCookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies()
    const cacheId = cookies.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  const cacheTag = await getCacheTag(tag)

  if (!cacheTag) {
    return {}
  }

  return { tags: [`${cacheTag}`] }
}

/**
 * Tags GLOBAIS do catalogo — produtos, categorias e colecoes — e a janela do
 * cache.
 *
 * `getCacheOptions` prefixa a tag com o id do visitante
 * (`products-<cacheId>`, gravado pelo `middleware.ts`), o que esta correto para
 * dado por sessao (carrinho, fulfillment) mas torna o catalogo IMPOSSIVEL de
 * invalidar por tag a partir do backend:
 *
 *   1. um webhook/admin nao conhece o cookie `_medusa_cache_id` do visitante,
 *      entao `revalidateTag("products")` nao alcancava nenhuma entrada — a
 *      entrada real estava registrada como `products-<cacheId>`;
 *   2. quando a requisicao chega sem o cookie (primeira visita, `curl`, SSR de
 *      crawler), `getCacheOptions` devolve `{}` e a entrada fica gravada em
 *      `force-cache` SEM tag nenhuma — stale para sempre.
 *
 * `getCatalogCacheOptions` resolve os dois: devolve a tag GLOBAL (purga para
 * todos, acionada por `POST /api/revalidate?tag=products`) somada a tag por
 * visitante, preservando o comportamento de `updateLocale`, que revalida apenas
 * a sessao que trocou o idioma.
 *
 * A JANELA (`revalidate`) e a terceira ponta — a que faltava.
 * -------------------------------------------------------------------------
 * `force-cache` sem `revalidate` guarda a resposta PARA SEMPRE. A chave do data
 * cache e a consulta (`limit`, `offset`, `order`, filtros), entao cada variacao
 * usada por uma pagina vira uma entrada propria e nenhuma delas expira.
 *
 * Foi assim que uma peca publicada no painel ficou invisivel nas secoes da
 * home: a Store API ja a devolvia, `/br/store` (chave `limit=100`, nunca usada
 * antes) mostrava a peca, e a home continuava com a lista anterior — a entrada
 * dela (`limit=8`, sem filtro) tinha sido gravada antes da publicacao e ficava
 * velha para sempre. A defasagem era infinita porque nada limpava: o aviso do
 * backend cobria so o conteudo (`modules/content/revalidate.ts`) e o catalogo
 * nao tinha aviso nenhum.
 *
 * Uma janela curta limita a defasagem ao mesmo "dentro de um minuto" ja
 * documentado no conteudo (`lib/data/content.ts` carrega o mesmo
 * `revalidate: 60`), e e o que faz a frase "a loja se atualiza sozinha em ate
 * um minuto" ser verdadeira tambem para o catalogo. O aviso sob demanda segue
 * valendo como caminho rapido: publicar no painel dispara
 * `backend/src/subscribers/catalog-revalidate.ts`, e na mao existe
 * `make revalidate TAG=products`.
 *
 * POR QUE 60, SE AS PAGINAS DE CATALOGO USAM `revalidate = 3600`
 * O `export const revalidate` da pagina e a janela do HTML; esta aqui e a do
 * DADO (a resposta da Store API), e as duas se somam. O dado e o piso: a home
 * (`revalidate = 60`) consome este MESMO `listProducts` — a chave dela e
 * `limit=8` — entao um dado de 1h faria a home re-renderizar a cada minuto e
 * continuar lendo a lista velha. Era o bug de origem, so que mais lento: com o
 * dado em 60s, a pagina de categoria mantem a hora dela e o aviso do painel
 * publica a mudanca antes disso, nos dois casos.
 */
export const CATALOG_CACHE_TAGS = [
  "products",
  "categories",
  "collections",
] as const

export type CatalogCacheTag = (typeof CATALOG_CACHE_TAGS)[number]

/**
 * Segundos de defasagem aceitos no catalogo. E o teto, nao o caso normal: o
 * aviso do backend publica a mudanca antes disso. Ver o bloco acima.
 */
export const CATALOG_CACHE_SECONDS = 60

export const getCatalogCacheOptions = async (
  tag: CatalogCacheTag
): Promise<{ tags: string[]; revalidate: number }> => {
  const perVisitor = await getCacheOptions(tag)
  const visitorTags = (perVisitor as { tags?: string[] }).tags

  return {
    tags: Array.from(new Set([tag, ...(visitorTags ?? [])])),
    revalidate: CATALOG_CACHE_SECONDS,
  }
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  })
}
