/**
 * Os chips de filtro de uma seção — a segunda coisa do CMS que é **referência**.
 * -------------------------------------------------------------------------
 * O chip da vitrine nasceu como **texto**: o campo `filters` do `featured`
 * guardava `["Todos", "Blazers", "Conjuntos", "Calças"]` dentro do `data`, e a
 * loja mandava o rótulo como busca (`q=Blazers`). Duas consequências, as duas
 * medidas no banco real: "Blazers" **não existe** no catálogo (o `q` devolvia
 * zero peças em silêncio, sem erro e sem log), e renomear uma categoria no
 * painel não mudava o chip — a cópia é que era o dado.
 *
 * Aqui o chip é referência: uma linha do link `content_section_category`
 * (`src/links/content-section-category.ts`) ligando a seção a uma categoria de
 * verdade, com a ordem numa coluna (`position`). O que a loja desenha é o nome e
 * o `handle` lidos **ao vivo** da categoria — o nome que o lojista editar amanhã
 * é o nome do chip amanhã —, e o filtro da vitrine é por `category_id`, não por
 * texto.
 *
 * **Três coisas que o chip não é.**
 *
 * - **Não é conteúdo (`data`).** Um id de categoria dentro do JSON não teria
 *   quem o limpasse: a categoria apagada viraria um chip que leva a lugar
 *   nenhum. O link é a mesma máquina da curadoria de produtos (`curation.ts`),
 *   com o ciclo de vida das duas pontas ligado.
 * - **Não tem "Todos".** Não existe categoria "todas": o chip que limpa o filtro
 *   é gesto da loja, e por isso não se grava. Antes era a **posição** que dizia
 *   qual chip limpava (`filters[0]`), então reordenar os chips trocava o
 *   significado de cada um sem nada acusar.
 * - **Não é lista de objetos.** O valor é o **id** da categoria; quem resolve
 *   id → `{ label, handle }` é a leitura (`listCategoryRefs`), na rota pública e
 *   no CRM.
 *
 * A escrita é a mesma da curadoria, e pelos mesmos motivos: `remoteLink.create`
 * é upsert (é assim que a reordenação entra), `remoteLink.dismiss` é soft
 * (`deleted_at`), e a lista manda — o que saiu é desfeito **antes** de o que
 * ficou ser regravado, para uma falha no meio deixar a seção sem chips (volta ao
 * catálogo inteiro) em vez de com uma lista pela metade.
 *
 * A integridade é de aplicação, como na curadoria: a tabela gerada pelo módulo
 * de links não tem chave estrangeira, então `resolveCategoryIds` (na rota admin)
 * recusa id inexistente antes de gravar. O buraco que sobra é o `DELETE` cru no
 * psql, o mesmo trade-off documentado em `src/links/content-section-product.ts`.
 */
import type { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "."
import { SECTION_FIELDS, type CategoryRef, type SectionType } from "./contract"
import type { QueryGraph, RemoteLink } from "./curation"
import { DEFAULT_FEATURED_FILTERS } from "./defaults"
import { listPositionFor } from "./order"

/**
 * A chave dos chips no corpo e no payload.
 *
 * É a **mesma** chave do campo em `SECTION_FIELDS.featured` (`contract.ts`), e
 * essa é a diferença entre os chips e a curadoria: o CRM edita os chips (a
 * curadoria não tem editor, e por isso `productIds` não é campo de contrato),
 * então a chave precisa existir no contrato para o formulário desenhá-la. Quem
 * a tira do `data` é o `splitPayload` (`payload.ts`): campo de contrato **e**
 * referência — não conteúdo, que é o que ela era.
 */
export const FILTERS_FIELD = "filters"

/**
 * A entidade do link, como o `query.graph` a conhece.
 *
 * Medido, e não adivinhado: `defineLink` compõe o nome do alias com os dois
 * lados na ordem em que são declarados (`product_category` + `content_section`).
 * O teste de unidade confere os dois (o arquivo do link e o nome aqui) para uma
 * divergência não virar uma query vazia — que seria a vitrine **sem chips**, sem
 * erro nenhum.
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
 * As linhas do link → `{ [id da seção]: [id de categoria, …] }`.
 *
 * A ordem é a que veio do banco (a query ordena por `position`): agrupar não
 * pode reordenar, senão os chips sairiam embaralhados — e a ordem é metade do
 * que a lista é.
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
 * A seção com os chips, **quando ela tem algum**.
 *
 * Sem chips a chave não sai do payload, como na curadoria: uma vitrine sem chip
 * nenhum é uma vitrine que mostra o catálogo inteiro, e a ausência da chave já
 * diz isso. Mandar `[]` diria a mesma coisa com mais bytes.
 *
 * **A chave que vem do `data` é descartada.** Uma base anterior à R1 ainda tem
 * os chips de **texto** gravados (`data.filters`, os rótulos digitados), e o
 * `listSections` achata o `data` no nível raiz — então eles chegariam ao payload
 * com a mesma chave do link e shape nenhum de chip (uma string não tem `label`
 * nem `handle`). Quem limpa a linha é o `retireTextFilters`
 * (`scripts/seed-content.ts`); aqui é a garantia de que, limpa ou não, o que a
 * loja e o CRM recebem como `filters` veio do **link**.
 */
export function withFilters<T extends { id: string }>(
  section: T,
  chips?: readonly CategoryRef[]
): Omit<T, "filters"> & { filters?: CategoryRef[] } {
  const { filters: _retired, ...rest } = section as T & { filters?: unknown }

  return chips?.length ? { ...rest, filters: [...chips] } : rest
}

/**
 * Lê os ids dos chips de várias seções numa query só.
 *
 * Como na curadoria, a leitura é na **entidade do link** e com
 * `order: { position: "ASC" }` (o `order` aninhado, na entidade da seção, é
 * ignorado pelo `query.graph` — ver o comentário longo em `curation.ts`).
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
 * O que **grava** os chips: um link por categoria, com a posição da lista.
 *
 * A posição vem do índice (10, 20, 30…), como na curadoria: a lista **é** a
 * ordem, e o CRM não manda número nenhum. `remoteLink.create` é upsert, então
 * reordenar chips é uma chamada só — o que já estava lá tem a posição
 * atualizada e o que entrou é criado.
 */
export function filterLinks(
  sectionId: string,
  categoryIds: readonly string[]
): LinkDefinition[] {
  return categoryIds.map((categoryId, index) => ({
    // O lado do catálogo é o modelo `product_category` do módulo de produto —
    // a mesma chave que o link declara (`defineLink`, `productCategory`).
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
 * Grava os chips de uma seção: a lista manda.
 *
 * Mesma ordem da curadoria, e pelo mesmo motivo: o que saiu é desfeito **antes**
 * de o que ficou ser regravado, para uma falha no meio deixar a seção sem chips
 * (o catálogo inteiro na vitrine) em vez de com uma lista pela metade — que é a
 * falha que o lojista não veria.
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
 * Os chips **prontos** para desenhar, por seção, na ordem da lista.
 *
 * O id é o que a seção guarda (a referência) e o nome/handle são lidos agora —
 * é esta função que faz o chip acompanhar uma categoria renomeada no painel. Um
 * id que sumiu do catálogo (o `DELETE` cru no psql, o buraco documentado no
 * arquivo do link) simplesmente não vira chip: a lista encolhe, e a vitrine não
 * ganha um botão que não filtra nada.
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
 * As categorias de um conjunto de ids, **na ordem pedida**.
 *
 * A ordem é a da lista que pediu (os chips de uma seção), e não a que o banco
 * devolveu: quem manda no que aparece primeiro é o `position` do link.
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
 * O catálogo inteiro, para o seletor de chips do CRM.
 *
 * Ordenado por `rank` — a ordem em que as categorias estão organizadas no painel
 * do Medusa —, e não por nome: o seletor abre na mesma ordem do catálogo, que é
 * a que o lojista reconhece.
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
 * Os ids das categorias que o **padrão** liga aos chips, na ordem declarada.
 *
 * A referência do padrão é por `handle` (`DEFAULT_FEATURED_FILTERS`): o id é
 * criado pelo seed a cada base, e um id escrito à mão em `defaults.ts` não
 * existiria em lugar nenhum.
 *
 * Handle que não existe no catálogo **sai da lista** em vez de virar erro: uma
 * base sem a categoria `conjuntos` recebe os outros três chips e a vitrine
 * continua de pé — o contrário seria o seed inteiro falhando por causa de uma
 * categoria que o lojista apagou.
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
 * O tipo de seção declara o campo de chips?
 *
 * A resposta sai do **contrato** (o `kind` do campo), e não de uma lista de tipos
 * escrita aqui ou em `restore.ts`: o dia em que uma segunda seção ganhar chips —
 * a vitrine da loja, por exemplo —, o padrão dela passa a ser ligado sem que
 * ninguém precise lembrar deste arquivo.
 */
export function hasChips(type: string): boolean {
  return (SECTION_FIELDS[type as SectionType] ?? []).some(
    (field) => field.name === FILTERS_FIELD && field.kind === "list:category"
  )
}

/**
 * Liga os chips **padrão** (`DEFAULT_FEATURED_FILTERS`) às seções que acabaram de
 * nascer.
 *
 * É o passo que o seed e o "Restaurar padrão" dão depois de criar a seção: o
 * chip é referência, e o link só existe com a seção no banco. Fica aqui, e não em
 * `restore.ts`, porque quem sabe ligar chips é este módulo — a função é a mesma
 * de qualquer outra escrita (`writeFilters`), com a lista vinda do padrão.
 *
 * `link`/`query` ausentes devolvem lista vazia em vez de estourar: sem container
 * não há link para escrever, e a seção criada continua válida — sem chips, a
 * vitrine mostra o catálogo inteiro. Quem não tem os dois (um teste de unidade)
 * não precisa deles para o que a função faz de útil.
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
 * Aposenta os chips de **texto** de uma base anterior à R1.
 *
 * Antes desta fase o `featured` guardava os chips como rótulos dentro do `data`
 * (`["Todos", "Blazers", "Conjuntos", "Calças"]`), e a seção não tinha linha
 * nenhuma no link. A chave antiga não é campo de contrato há dois passos: ela
 * nunca mais é escrita e continuaria no `data` para sempre, porque o `PATCH`
 * **mescla** o `data` em vez de substituí-lo.
 *
 * O que a função faz, então, é o fecho da conversão:
 *
 *   1. **neutraliza** `filters` no `data` (grava `null` na chave);
 *   2. a seção que ficou **sem** chips no link recebe os do padrão — por
 *      `handle`, ver `defaultFilterIds`.
 *
 * **Por que neutralizar, e não apagar a chave.** Medido em 2026-09-29, com uma
 * sonda: o `updateContentSections` do módulo **mescla** o JSON da coluna `data`
 * no nível raiz — gravar `data` sem a chave deixa a chave onde estava (a sonda
 * gravou `{probe: true}` e o `data` ficou com a chave nova **mais** todas as
 * antigas). Apagar a chave exigiria SQL cru (`data - 'filters'`), e um caminho
 * de escrita por fora do módulo não se paga por causa de um campo aposentado:
 * `null` é o valor que diz "não há nada aqui", e a **leitura** já descarta a
 * chave (`withFilters`) — nenhum consumidor vê o resto. A consequência geral
 * (o `data` da seção só cresce em chave) está registrada no plano.
 *
 * O passo 2 **não** tenta adivinhar o que os rótulos antigos queriam dizer: eles
 * não são categorias (é o ponto da fase — "Blazers" não existe no catálogo), e
 * uma conversão por semelhança de nome erraria em silêncio. A seção recebe o
 * padrão, que é o que o seed e o "Restaurar padrão" gravam numa base nova, e o
 * lojista ajusta no CRM — agora com o catálogo de verdade na frente.
 *
 * Idempotente por construção: numa base já convertida não há chave antiga nem
 * seção sem chips, e nada é gravado.
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

    // A chave é **neutralizada**, não apagada: o update do serviço mescla o JSON
    // (medido em 2026-09-29 — ver o cabeçalho desta função), então o `data` sem
    // ela deixaria a chave exatamente onde estava. `null` é o valor que diz "não
    // há nada aqui", e a leitura descarta a chave de qualquer forma
    // (`withFilters`).
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

  // Quem já tem chips no link não é tocado: pode ser escolha do lojista feita
  // no CRM depois da conversão, e sobrescrevê-la seria trocar o trabalho dele
  // pelo padrão sem aviso.
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

