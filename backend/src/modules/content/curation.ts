/**
 * A curadoria de produtos de uma seção — a única parte do CMS que é
 * **referência**, e não cópia.
 * -------------------------------------------------------------------------
 * Uma seção tem duas relações com o mundo, e elas se parecem de longe:
 *
 *   catálogo   **referência** — quais produtos, em que ordem (este arquivo);
 *   texto      **cópia**      — `title`, `eyebrow`, `viewAllHref` (`data`).
 *
 * A diferença importa na hora de apagar: um `id` de produto dentro do `data`
 * seria uma string, e apagar o produto deixaria a vitrine apontando para o
 * nada — sem erro, sem log, um buraco. Aqui a curadoria é o **link do Medusa**
 * (`src/links/content-section-product.ts`), com a ordem numa coluna de verdade
 * e o ciclo de vida dos dois lados ligado (o Medusa limpa o link quando um
 * produto é removido; `DELETE /admin/content` limpa o da seção).
 *
 * **As três operações, e onde cada uma acontece.** A leitura é `query.graph` na
 * entidade do link (a que ordena — `order` na seção, atravessando
 * `product_link.position`, **não** ordena: é medido, e está no comentário de
 * `readCuration`). A escrita é `remoteLink.create`, que é um **upsert**: é assim
 * que a reordenação entra sem uma tabela nossa. E a remoção é
 * `remoteLink.dismiss`, que é **soft** (`deleted_at`), como todo vínculo no
 * Medusa: "saiu da curadoria" não é "apagou o produto", e readicionar depois
 * restaura a mesma linha. O `remoteLink.delete` (o que a rota usa ao apagar a
 * seção) também é soft — medido: as linhas ficam no banco com `deleted_at`
 * preenchido (`Link.delete` chama o cascade com `softDelete`), e é por isso que
 * nenhuma contagem de linha *viva* muda de significado aqui.
 *
 * **A linha não tem FK, e é por isso que a rota valida o `id`.** A tabela
 * `content_section_product` é gerada pelo módulo de links do Medusa, e ele não
 * cria chaves estrangeiras (conferido: `product_variant_inventory_item`, a
 * tabela de link do próprio Medusa, também não tem). A integridade é de
 * aplicação: `resolveProductIds` (na rota) recusa id inexistente antes de
 * gravar. O buraco que sobra é estreito, mas existe: um produto apagado **por
 * fora** da API (um `DELETE` no psql) deixa a linha do link ativa apontando para
 * nada — a loja não acharia o produto e a curadoria teria um lugar vazio. É o
 * trade-off do Medusa (link é estado, não registro), e o preço de não manter o
 * link na mão.
 */
import type {
  LinkDefinition,
  RemoteQueryFunction,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "."
import { curationPositionFor } from "./order"

/**
 * A entidade do link, como o `query.graph` a conhece.
 *
 * Medido, e não adivinhado: `defineLink` compõe o nome do alias com os dois
 * lados na ordem em que são declarados (`product` + `content_section`). Se o
 * link mudar de forma, este nome muda — e o teste de unidade da curadoria
 * confere os dois (o arquivo do link e o nome aqui) para a divergência não
 * virar uma query vazia.
 */
export const CURATION_ENTITY = "product_content_section"

/**
 * A chave da curadoria no corpo e no payload — **não** é coluna da seção nem
 * campo do `data` (ver `payload.ts`: é o terceiro destino de uma chave).
 */
export const CURATION_FIELD = "productIds"

/** Uma linha do link, como a query a devolve. */
type CurationRow = {
  content_section_id: string
  product_id: string
}

/**
 * Só o `graph` do `query` do container.
 *
 * O container entrega `Omit<RemoteQueryFunction, symbol>` (o Medusa pendura um
 * símbolo na função registrada), então pedir o tipo inteiro não casaria nem com o
 * que ele mesmo registra. O que a curadoria usa é o `graph`, e é isso que este
 * tipo diz.
 */
export type QueryGraph = Pick<RemoteQueryFunction, "graph">

/**
 * As linhas do link → `{ [id da seção]: [id de produto, …] }`.
 *
 * A ordem é a que veio do banco (a query ordena por `position`): agrupar não
 * pode reordenar, senão a vitrine mostraria a curadoria embaralhada.
 */
export function groupCuration(
  rows: readonly CurationRow[]
): Record<string, string[]> {
  const curation: Record<string, string[]> = {}

  for (const row of rows) {
    const list = (curation[row.content_section_id] ??= [])
    list.push(row.product_id)
  }

  return curation
}

/**
 * A seção com a curadoria, **quando ela existe**.
 *
 * Sem curadoria a chave não sai do payload: a seção que lista o catálogo sozinha
 * (o `featured` do protótipo) tem o modo automático como padrão, e a ausência da
 * chave já diz isso. Mandar `[]` diria a mesma coisa com mais bytes, e obrigaria
 * cada renderizador da loja a decidir entre `undefined` e vazio.
 */
export function withCuration<T extends { id: string }>(
  section: T,
  productIds?: readonly string[]
): T & { productIds?: string[] } {
  return productIds?.length ? { ...section, productIds: [...productIds] } : section
}

/**
 * Lê a curadoria de várias seções numa query só (a página inteira, ou uma
 * seção).
 *
 * A leitura é na **entidade do link** e o teste que decidiu isso está aqui:
 * `query.graph` na seção com `pagination.order` em `product_link.position`
 * devolve as linhas **na ordem de inserção** — o `order` aninhado é ignorado
 * (medido em 2026-09-29, com duas linhas de posições 10 e 20). Na entidade do
 * link, `order: { position: "ASC" }` ordena de verdade. Sem isso a curadoria
 * sairia embaralhada, e a ordem é metade do que ela é.
 */
export async function readCuration(
  query: QueryGraph,
  sectionIds: readonly string[]
): Promise<Record<string, string[]>> {
  if (!sectionIds.length) {
    return {}
  }

  const { data } = await query.graph({
    entity: CURATION_ENTITY,
    fields: ["content_section_id", "product_id", "position"],
    filters: { content_section_id: [...sectionIds] },
    pagination: { order: { position: "ASC" } },
  })

  return groupCuration(data as CurationRow[])
}

/**
 * O que **grava** a curadoria: um link por produto, com a posição da lista.
 *
 * A posição vem do índice (10, 20, 30…): a lista **é** a ordem, e o CRM não
 * manda número nenhum. `remoteLink.create` é upsert, então uma reordenação é uma
 * chamada só — o que já estava lá tem a posição atualizada e o que entrou é
 * criado; o que saiu é desfeito por `curationPairs` + `dismiss`.
 */
export function curationLinks(
  sectionId: string,
  productIds: readonly string[]
): LinkDefinition[] {
  return productIds.map((productId, index) => ({
    [Modules.PRODUCT]: { product_id: productId },
    [CONTENT_MODULE]: { content_section_id: sectionId },
    data: { position: curationPositionFor(index) },
  }))
}

/** Os pares a desvincular (o `dismiss` do Medusa: sai da curadoria, não vira órfão). */
export function curationPairs(
  sectionId: string,
  productIds: readonly string[]
): LinkDefinition[] {
  return productIds.map((productId) => ({
    [Modules.PRODUCT]: { product_id: productId },
    [CONTENT_MODULE]: { content_section_id: sectionId },
  }))
}

/** O que estava na curadoria e não está mais. */
export function removedFromCuration(
  current: readonly string[],
  next: readonly string[]
): string[] {
  const keeping = new Set(next)

  return current.filter((productId) => !keeping.has(productId))
}

/**
 * O que a curadoria precisa do `remoteLink` — a assinatura mínima, e não a
 * classe: o módulo não importa o pacote de links do Medusa só para nomear um
 * tipo (quem o resolve é a rota, que tem o container).
 */
export type RemoteLink = {
  create: (links: LinkDefinition[]) => Promise<unknown>
  dismiss: (links: LinkDefinition[]) => Promise<unknown>
  delete: (entity: {
    [moduleName: string]: Record<string, string | string[]>
  }) => Promise<unknown>
}

/**
 * Grava a curadoria de uma seção: a lista manda.
 *
 * O que saiu é desfeito **antes** de o que ficou ser regravado: se a gravação
 * falhar no meio, a seção fica sem curadoria (volta ao modo automático) em vez
 * de com uma lista pela metade — que é a falha que o lojista não veria.
 */
export async function writeCuration({
  link,
  query,
  sectionId,
  productIds,
}: {
  link: RemoteLink
  query: QueryGraph
  sectionId: string
  productIds: readonly string[]
}): Promise<void> {
  const current = (await readCuration(query, [sectionId]))[sectionId] ?? []
  const removed = removedFromCuration(current, productIds)

  if (removed.length) {
    await link.dismiss(curationPairs(sectionId, removed))
  }

  if (productIds.length) {
    await link.create(curationLinks(sectionId, productIds))
  }
}