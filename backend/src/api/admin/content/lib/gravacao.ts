/** As referências de um corpo de seção: o que precisa existir antes de gravar. */
import { FILTERS_FIELD } from "../../../../modules/content/filters"
import {
  readPosition,
  resolveCategoryIds,
  resolveProductIds,
} from "../../../../modules/content/resolvers"

/** As referências resolvidas, ou o motivo de o corpo não servir. */
export type Preparo =
  | { ok: false; message: string }
  | {
      ok: true
      productIds?: string[]
      categoryIds?: string[]
      position?: number
    }

/**
 * A curadoria, os chips e a posição de um corpo — conferidos contra o banco, na
 * ordem em que a resposta os cobra. As duas portas (`POST` e `PATCH`) faziam
 * esta sequência em cópias que podiam divergir.
 */
export async function resolverReferencias(
  query: Parameters<typeof resolveProductIds>[1],
  {
    curation,
    references,
    position,
  }: {
    curation: unknown
    references: Record<string, unknown> | undefined
    position: unknown
  }
): Promise<Preparo> {
  const { ids: productIds, error: curationError } = await resolveProductIds(
    curation,
    query
  )

  if (curationError) {
    return { ok: false, message: curationError }
  }

  const { ids: categoryIds, error: filtersError } = await resolveCategoryIds(
    references?.[FILTERS_FIELD],
    query
  )

  if (filtersError) {
    return { ok: false, message: filtersError }
  }

  // `position` passa pela mesma conferência nas duas portas: `Number("abc")` é
  // `NaN`, e `NaN` na coluna não dá erro — dá ordem indefinida na loja, que é o
  // defeito que a renumeração do CRM existe para evitar.
  const { position: lida, error: positionError } = readPosition(position)

  if (positionError) {
    return { ok: false, message: positionError }
  }

  return { ok: true, productIds, categoryIds, position: lida }
}
