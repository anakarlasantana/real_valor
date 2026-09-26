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
 * Tags GLOBAIS do catalogo — produtos, categorias e colecoes.
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
 */
export const CATALOG_CACHE_TAGS = [
  "products",
  "categories",
  "collections",
] as const

export type CatalogCacheTag = (typeof CATALOG_CACHE_TAGS)[number]

export const getCatalogCacheOptions = async (
  tag: CatalogCacheTag
): Promise<{ tags: string[] }> => {
  const perVisitor = await getCacheOptions(tag)
  const visitorTags = (perVisitor as { tags?: string[] }).tags

  return { tags: Array.from(new Set([tag, ...(visitorTags ?? [])])) }
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
