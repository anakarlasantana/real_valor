/**
 * A janela do cache do catálogo — e a tag global que a acompanha.
 * -------------------------------------------------------------------------
 * Este teste existe por um bug **medido em produção** (localhost, mas o mesmo
 * código): a lojista publicou uma peça no painel, a Store API já a devolvia,
 * `/br/store` mostrava a peça — e as seções da home continuavam com a lista
 * anterior, para sempre.
 *
 * A causa não era dado: era `force-cache` **sem `revalidate`**. A chave do data
 * cache do Next é a consulta (limit/offset/order/filtros), então cada variação
 * usada por uma página vira uma entrada própria — e nenhuma delas expirava. A
 * entrada da home (`limit=8`) tinha sido gravada antes da publicação; a de
 * `/br/store` (`limit=100`) nasceu depois, e por isso mostrava a peça. O aviso
 * do backend só limpava `content`; o catálogo não tinha aviso nem janela.
 *
 * A asserção marcada com ⭐ é a que prende a correção: **`revalidate` tem de
 * sair do `getCatalogCacheOptions`**, e não só das tags. Um `next` com as tags
 * certas e sem janela passa em qualquer outro teste deste repositório e deixa o
 * bug exatamente como estava.
 *
 * O segundo ⭐ é o motivo de a tag global vir **primeiro** na lista: é a única
 * que o backend conhece (`POST /api/revalidate?tag=products`), então ela não
 * pode depender de haver cookie de visitante.
 *
 * `next/headers` é dublê: o que se testa é a decisão de cache, não o Next.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * O `vi.mock` é hoisted, então a função precisa nascer dentro da factory — ou
 * seja, dentro do `vi.hoisted`, que sobe a declaração junto com o mock e permite
 * trocar o que o `cookies()` devolve de um teste para o outro.
 */
const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }))

vi.mock("next/headers", () => ({ cookies: cookiesMock }))

import {
  CATALOG_CACHE_SECONDS,
  CATALOG_CACHE_TAGS,
  getCatalogCacheOptions,
} from "@lib/data/cookies"

/** O `cookies()` do Next, com o `_medusa_cache_id` que o `middleware.ts` grava. */
function comVisitante(cacheId?: string) {
  cookiesMock.mockResolvedValue({
    get: (nome: string) =>
      nome === "_medusa_cache_id" && cacheId ? { value: cacheId } : undefined,
  })
}

beforeEach(() => {
  cookiesMock.mockReset()
})

describe("a janela", () => {
  it("⭐ a entrada do catálogo expira — sem isto ela fica velha para sempre", async () => {
    comVisitante()

    const next = await getCatalogCacheOptions("products")

    expect(next.revalidate).toBe(CATALOG_CACHE_SECONDS)
    // O número em si é política, e está escrito onde se lê: o mesmo "dentro de
    // um minuto" que o conteúdo já promete (`lib/data/content.ts`). Amarrar o
    // valor aqui é o que faz mudar a política ser uma decisão, e não um efeito.
    expect(CATALOG_CACHE_SECONDS).toBe(60)
  })

  it("vale para as três tags do catálogo, não só `products`", async () => {
    comVisitante()

    for (const tag of CATALOG_CACHE_TAGS) {
      const next = await getCatalogCacheOptions(tag)

      expect(next.tags[0]).toBe(tag)
      expect(next.revalidate).toBe(60)
    }
  })
})

describe("as tags", () => {
  it("⭐ sem cookie de visitante, a tag global continua saindo", async () => {
    // Primeira visita, `curl`, crawler: é o caso em que a entrada antes era
    // gravada SEM tag nenhuma — impossível de invalidar.
    comVisitante()

    const next = await getCatalogCacheOptions("products")

    expect(next.tags).toEqual(["products"])
  })

  it("com cookie de visitante, a tag global vem primeiro e a do visitante junto", async () => {
    comVisitante("visitante-1")

    const next = await getCatalogCacheOptions("products")

    // A ordem importa: `tags[0]` é a tag que o backend publica. A segunda é a
    // que o `updateLocale` do cabeçalho usa para limpar só a sessão que trocou
    // de idioma.
    expect(next.tags).toEqual(["products", "products-visitante-1"])
  })
})
