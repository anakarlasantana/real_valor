/**
 * Os chips de filtro de uma seção — a **referência** `content_section_category`.
 * O chip era **texto** (`data.filters`): "Blazers" não existia no catálogo (a
 * busca devolvia zero em silêncio) e renomear a categoria não mudava o chip.
 */
import type { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "."
import { SECTION_FIELDS, type CategoryRef, type SectionType } from "./contract"
import type { QueryGraph, RemoteLink } from "./curation"
import { DEFAULT_FEATURED_FILTERS } from "./defaults"
import { listPositionFor } from "./order"

/**
 * A chave dos chips no corpo e no payload — a **mesma** chave do campo em
 * `SECTION_FIELDS.featured`, que o CRM edita. O `splitPayload` a tira do `data`.
 */
export const FILTERS_FIELD = "filters"

/**
 * A entidade do link, como o `query.graph` a conhece. `defineLink` compõe o
 * alias com os dois lados na ordem declarada; o teste confere os dois.
 */
export const FILTERS_ENTITY = "product_category_content_section"

/** A entidade da categoria, para a leitura dos rótulos ao vivo. */
const CATEGORY_ENTITY = "product_category"

/** Uma linha do link, como a query a devolve. */
type FilterRow = {
  content_section_id: string
  product_category_id: string
}

/** Uma categoria, como o `query.graph` a devolve. */
type CategoryRow = {
  id: string
  name: string | null
  handle: string | null
}


/**
 * As linhas do link → `{ [id da seção]: [id de categoria, …] }`. A ordem é a do
 * banco (a query ordena por `position`): agrupar não pode reordenar.
 */
export function groupFilters(
  rows: readonly FilterRow[]
): Record<string, string[]> {
  const chips: Record<string, string[]> = {}

  for (const row of rows) {
    const list = (chips[row.content_section_id] ??= [])
    list.push(row.product_category_id)
  }

  return chips
}

/**
 * A seção com os chips, **quando ela tem algum**. **A chave que vem do `data` é
 * descartada** (chips de texto de uma base anterior à R1); o link é a verdade.
 */
export function withFilters<T extends { id: string }>(
  section: T,
  chips?: readonly CategoryRef[]
): Omit<T, "filters"> & { filters?: CategoryRef[] } {
  const { filters: _retired, ...rest } = section as T & { filters?: unknown }

  return chips?.length ? { ...rest, filters: [...chips] } : rest
}

/**
 * Lê os ids dos chips de várias seções numa query só. A leitura é na entidade do
 * link com `order: { position: "ASC" }` (o `order` na seção é ignorado).
 */
export async function readFilters(
  query: QueryGraph,
  sectionIds: readonly string[]
): Promise<Record<string, string[]>> {
  if (!sectionIds.length) {
    return {}
  }

  const { data } = await query.graph({
    entity: FILTERS_ENTITY,
    fields: ["content_section_id", "product_category_id", "position"],
    filters: { content_section_id: [...sectionIds] },
    pagination: { order: { position: "ASC" } },
  })

  return groupFilters(data as FilterRow[])
}

/**
 * O que **grava** os chips: um link por categoria, com a posição da lista
 * (10, 20, 30…). `remoteLink.create` é upsert: reordenar é uma chamada só.
 */
export function filterLinks(
  sectionId: string,
  categoryIds: readonly string[]
): LinkDefinition[] {
  return categoryIds.map((categoryId, index) => ({
    // O lado do catálogo é o modelo `product_category` — a mesma chave do link.
    [Modules.PRODUCT]: { product_category_id: categoryId },
    [CONTENT_MODULE]: { content_section_id: sectionId },
    data: { position: listPositionFor(index) },
  }))
}

/** Os pares a desvincular (o `dismiss` do Medusa: sai da vitrine, sem órfão). */
export function filterPairs(
  sectionId: string,
  categoryIds: readonly string[]
): LinkDefinition[] {
  return categoryIds.map((categoryId) => ({
    [Modules.PRODUCT]: { product_category_id: categoryId },
    [CONTENT_MODULE]: { content_section_id: sectionId },
  }))
}

/** O que estava nos chips e não está mais. */
export function removedFromFilters(
  current: readonly string[],
  next: readonly string[]
): string[] {
  const keeping = new Set(next)

  return current.filter((categoryId) => !keeping.has(categoryId))
}

/**
 * Grava os chips de uma seção: a lista manda. O que saiu é desfeito **antes** de
 * o que ficou ser regravado — uma falha no meio deixa a seção sem chips.
 */
export async function writeFilters({
  link,
  query,
  sectionId,
  categoryIds,
}: {
  link: RemoteLink
  query: QueryGraph
  sectionId: string
  categoryIds: readonly string[]
}): Promise<void> {
  const current = (await readFilters(query, [sectionId]))[sectionId] ?? []
  const removed = removedFromFilters(current, categoryIds)

  if (removed.length) {
    await link.dismiss(filterPairs(sectionId, removed))
  }

  if (categoryIds.length) {
    await link.create(filterLinks(sectionId, categoryIds))
  }
}



/** A linha da categoria → o chip, como a vitrine o desenha. */
function categoryRef(row: CategoryRow): CategoryRef {
  return {
    categoryId: row.id,
    // Nome em branco não é motivo para o chip sumir da vitrine: o `handle` é o
    // que filtra e o que vai na URL, então ele é o rótulo de emergência.
    label: row.name?.trim() || row.handle?.trim() || row.id,
    handle: row.handle ?? "",
  }
}

/**
 * Os chips **prontos**, por seção, na ordem da lista. **Id que sumiu do catálogo
 * não vira chip**: a lista encolhe, e a vitrine não ganha um botão que não filtra.
 */
export async function readChips(
  query: QueryGraph,
  sectionIds: readonly string[]
): Promise<Record<string, CategoryRef[]>> {
  const idsBySection = await readFilters(query, sectionIds)
  const refs = await listCategoryRefs(
    query,
    [...new Set(Object.values(idsBySection).flat())]
  )
  const byId = new Map(refs.map((ref) => [ref.categoryId, ref]))

  return Object.fromEntries(
    Object.entries(idsBySection).map(([sectionId, ids]) => [
      sectionId,
      ids
        .map((id) => byId.get(id))
        .filter((ref): ref is CategoryRef => Boolean(ref)),
    ])
  )
}

/**
 * As categorias de um conjunto de ids, **na ordem pedida** (a dos chips), não a
 * do banco: quem manda é o `position` do link. Id que sumiu não vira ref.
 */
export async function listCategoryRefs(
  query: QueryGraph,
  categoryIds: readonly string[]
): Promise<CategoryRef[]> {
  if (!categoryIds.length) {
    return []
  }

  const { data } = await query.graph({
    entity: CATEGORY_ENTITY,
    fields: ["id", "name", "handle"],
    filters: { id: [...categoryIds] },
  })
  const found = new Map(
    (data as CategoryRow[]).map((row) => [row.id, categoryRef(row)])
  )

  return categoryIds
    .map((id) => found.get(id))
    .filter((ref): ref is CategoryRef => Boolean(ref))
}

/**
 * O catálogo inteiro, para o seletor de chips do CRM. Ordenado por `rank` — a
 * ordem do painel do Medusa —, e não por nome.
 */
export async function readCategoryCatalog(
  query: QueryGraph
): Promise<CategoryRef[]> {
  const { data } = await query.graph({
    entity: CATEGORY_ENTITY,
    fields: ["id", "name", "handle"],
    pagination: { order: { rank: "ASC" } },
  })

  return (data as CategoryRow[]).map(categoryRef)
}

/**
 * Os ids das categorias que o **padrão** liga aos chips, na ordem declarada, por
 * `handle` (`DEFAULT_FEATURED_FILTERS`): o id é criado pelo seed a cada base.
 * Handle que não existe **sai da lista** — uma categoria apagada não derruba tudo.
 */
export async function defaultFilterIds(query: QueryGraph): Promise<string[]> {
  if (!DEFAULT_FEATURED_FILTERS.length) {
    return []
  }

  const { data } = await query.graph({
    entity: CATEGORY_ENTITY,
    fields: ["id", "handle"],
    filters: { handle: [...DEFAULT_FEATURED_FILTERS] },
  })
  const byHandle = new Map(
    (data as CategoryRow[]).map((row) => [row.handle, row.id])
  )

  return DEFAULT_FEATURED_FILTERS.map((handle) => byHandle.get(handle)).filter(
    (id): id is string => Boolean(id)
  )
}

/**
 * O tipo de seção declara o campo de chips? A resposta sai do **contrato** (o
 * `kind`), não de uma lista de tipos — uma segunda seção com chips se liga só.
 */
export function hasChips(type: string): boolean {
  return (SECTION_FIELDS[type as SectionType] ?? []).some(
    (field) => field.name === FILTERS_FIELD && field.kind === "list:category"
  )
}

/**
 * Liga os chips **padrão** às seções recém-criadas (o passo do seed e do
 * "Restaurar padrão"), com `writeFilters` e a lista do padrão. Sem `link`/
 * `query` a resposta é lista vazia: sem contêiner não há link.
 */
export async function writeDefaultChips({
  link,
  query,
  sectionIds,
}: {
  link?: RemoteLink
  query?: QueryGraph
  sectionIds: readonly string[]
}): Promise<string[]> {
  if (!link || !query || !sectionIds.length) {
    return []
  }

  const categoryIds = await defaultFilterIds(query)

  if (!categoryIds.length) {
    return []
  }

  for (const sectionId of sectionIds) {
    await writeFilters({ link, query, sectionId, categoryIds })
  }

  return [...sectionIds]
}

/** Só o que a conversão do `data` precisa do serviço do módulo. */
type SectionWriter = {
  updateContentSections: (
    rows: { id: string; data: Record<string, unknown> }[]
  ) => Promise<unknown>
}

/**
 * Aposenta os chips de **texto** de uma base anterior à R1. O `featured`
 * guardava os rótulos em `data.filters`, e o `PATCH` **mescla** o `data` em vez
 * de substituí-lo. A função **neutraliza** a chave (grava `null`; o update
 * mescla o JSON na raiz, medido) e dá às seções sem chips os do padrão.
 */
export async function retireTextFilters({
  service,
  link,
  query,
  sections,
}: {
  service: SectionWriter
  link?: RemoteLink
  query?: QueryGraph
  sections: readonly { id: string; type: string; data?: unknown }[]
}): Promise<{ cleaned: string[]; chipped: string[] }> {
  const cleaned: string[] = []
  /** As seções que perderam a chave **e** podem ter chips (pelo tipo). */
  const candidates: string[] = []

  for (const section of sections) {
    const data = (section.data ?? {}) as Record<string, unknown>

    if (!Array.isArray(data[FILTERS_FIELD])) {
      continue
    }

    // Neutralizada, não apagada: o update do serviço mescla o JSON, então o
    // `data` sem ela manteria a chave. `null` diz "não há nada aqui".
    await service.updateContentSections([
      { id: section.id, data: { [FILTERS_FIELD]: null } },
    ])
    cleaned.push(section.id)

    if (hasChips(section.type)) {
      candidates.push(section.id)
    }
  }

  if (!candidates.length) {
    return { cleaned, chipped: [] }
  }

  // Quem já tem chips no link não é tocado: pode ser escolha do lojista no CRM
  // depois da conversão, e sobrescrevê-la trocaria o trabalho dele pelo padrão.
  const current = query ? await readFilters(query, candidates) : {}

  return {
    cleaned,
    chipped: await writeDefaultChips({
      link,
      query,
      sectionIds: candidates.filter((id) => !current[id]?.length),
    }),
  }
}

