/**
 * Os resolvedores do corpo do CRM — o que a rota precisa antes de gravar.
 * -------------------------------------------------------------------------
 * Cada um responde a mesma forma — `{ valor?, error? }` —, e a rota só decide o
 * status. São quatro, e os quatro existem porque o corpo é **de terceiros**
 * (um `curl`, um script, o painel): nada nele pode chegar ao banco sem alguém
 * dizer que é válido.
 *
 * | Resolvedor | O que confere |
 * | --- | --- |
 * | `resolveSectionId` | a âncora (`id`): apelido em minúsculas, sem espaço e **livre** — ela é o `id` da linha **e** o fragmento que o menu usa (`/#hero`) |
 * | `readPosition` | a `position` é número de verdade: `Number("abc")` é `NaN`, e `NaN` numa coluna `numeric` **não** dá erro — quem quebra é a ordem da vitrine, sem nada acusar |
 * | `resolveProductIds` | a curadoria: lista de ids de produto, sem repetição, todos existentes |
 * | `resolveCategoryIds` | os chips: lista de ids de categoria, sem repetição, todas existentes |
 *
 * **As duas referências são conferidas em código porque o link não tem FK.** A
 * tabela do link é gerada pelo módulo de links do Medusa, que não cria chave
 * estrangeira (conferido em `content_section_product`: nenhum `references`).
 * Sem estas checagens, um id inventado viraria uma linha que nenhuma query
 * hidrata — um buraco silencioso na vitrine, que é o defeito que a curadoria e
 * os chips como link vieram evitar.
 *
 * `undefined` é "não veio" em todas as listas (não mexe) e `[]` é "esvazia": é a
 * diferença que faz um PATCH de texto não apagar a curadoria nem os chips de
 * ninguém. Quem sabe disso é a rota; aqui só se responde o que veio.
 */
import { CURATION_FIELD, type QueryGraph } from "./curation"
import { FILTERS_FIELD, listCategoryRefs } from "./filters"
import type ContentModuleService from "./service"

/**
 * A curadoria que veio no corpo: lista de `id` de produto, sem repetição, e
 * todos existentes.
 *
 * `undefined` é "não veio" (não mexe); `[]` é "esvazia" — e a diferença é o que
 * faz um PATCH de texto não apagar a curadoria de ninguém.
 *
 * A **existência** é conferida aqui, e não pelo banco, porque a tabela do link
 * não tem chave estrangeira (é gerada pelo módulo de links do Medusa, que não as
 * cria — ver `modules/content/curation.ts`). Sem esta checagem, um id inventado
 * viraria uma linha que nenhuma query de produto hidrata: um buraco silencioso na
 * vitrine, que é o defeito que a curadoria como link veio evitar.
 */
export async function resolveProductIds(
  value: unknown,
  query: QueryGraph
): Promise<{ ids?: string[]; error?: string }> {
  if (value === undefined) {
    return {}
  }

  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return {
      error: `Campo "${CURATION_FIELD}" deve ser uma lista de ids de produto.`,
    }
  }

  const ids = value as string[]

  if (new Set(ids).size !== ids.length) {
    return {
      error:
        `Campo "${CURATION_FIELD}" tem id repetido: a curadoria é uma lista ` +
        `ordenada, e cada produto aparece uma vez.`,
    }
  }

  if (!ids.length) {
    return { ids }
  }

  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: ids },
  })
  const found = new Set((data as { id: string }[]).map((product) => product.id))
  const missing = ids.filter((id) => !found.has(id))

  if (missing.length) {
    return {
      error:
        `A curadoria aponta produto que não existe (ou foi removido): ` +
        `${missing.join(", ")}.`,
    }
  }

  return { ids }
}
/**
 * Os chips que vieram no corpo: lista de `id` de categoria, sem repetição, e
 * todas existentes.
 *
 * Mesma leitura da curadoria: `undefined` é "não veio" (não mexe nos chips, o
 * PATCH que só mudou um texto) e `[]` é "esvazia" — a vitrine volta a mostrar o
 * catálogo inteiro.
 *
 * A **existência** é conferida aqui, e não pelo banco, porque a tabela do link
 * não tem chave estrangeira (é gerada pelo módulo de links do Medusa — ver
 * `modules/content/filters.ts`). Sem esta checagem, um id inventado viraria uma
 * linha que nenhuma leitura de categoria hidrata, ou seja, um chip que não
 * filtra nada — o mesmo buraco silencioso que o chip "Blazers" era.
 *
 * O produto, ao lado, tem a mesma função e o mesmo motivo: são as duas
 * referências da seção (`productIds` e `filters`), e o que muda entre elas é só
 * o que a lista aponta.
 */
export async function resolveCategoryIds(
  value: unknown,
  query: QueryGraph
): Promise<{ ids?: string[]; error?: string }> {
  if (value === undefined) {
    return {}
  }

  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return {
      error: `Campo "${FILTERS_FIELD}" deve ser uma lista de ids de categoria.`,
    }
  }

  const ids = value as string[]

  if (new Set(ids).size !== ids.length) {
    return {
      error:
        `Campo "${FILTERS_FIELD}" tem id repetido: os chips são uma lista ` +
        `ordenada, e cada categoria aparece uma vez.`,
    }
  }

  if (!ids.length) {
    return { ids }
  }

  // A leitura é a mesma que a dos chips (`listCategoryRefs`), e de propósito: um
  // id que ela não devolve é exatamente o id que não viraria chip nenhum.
  const refs = await listCategoryRefs(query, ids)
  const found = new Set(refs.map((ref) => ref.categoryId))
  const missing = ids.filter((id) => !found.has(id))

  if (missing.length) {
    return {
      error:
        `Os filtros apontam categoria que não existe (ou foi removida): ` +
        `${missing.join(", ")}.`,
    }
  }

  return { ids }
}
/**
 * A `position` do corpo, quando ela veio.
 *
 * `Number("abc")` é `NaN`, e `NaN` numa coluna `numeric` do Postgres **não** é
 * erro — quem quebra é a ordenação da vitrine, que passa a ser indefinida sem
 * nada acusar. O corpo chega como JSON de terceiros, então o valor é conferido
 * aqui: ausente segue o fluxo de cada rota (no POST, a seção vai para o fim);
 * não-numérico é 400 com o nome do campo.
 */
export function readPosition(value: unknown): { position?: number; error?: string } {
  if (value === undefined || value === null) {
    return {}
  }

  const position = Number(value)

  if (!Number.isFinite(position)) {
    return { error: 'Campo "position" deve ser um número.' }
  }

  return { position }
}
/**
 * A âncora (`id`) da seção nova.
 *
 * `id` é a chave do bloco **e** o fragmento que o menu usa (`/#hero`, o link
 * "Início" do cabeçalho padrão). Daí as duas regras: formato de apelido (só
 * minúsculas, números e hífen — ele vira fragmento de URL) e nenhuma colisão,
 * porque dois blocos com o mesmo id deixariam os dois links rolando para a
 * seção errada.
 *
 * Sem `id` no corpo, quem gera é o banco (o comportamento de antes, para um
 * bloco criado por script). Com `id`, ele é respeitado — é o que permite ao CRM
 * oferecer a âncora e ao "restaurar seções padrão" recriar `hero`, `nav` e
 * `footer` com os ids que a loja já conhece e para os quais aponta.
 */
export async function resolveSectionId(
  requested: unknown,
  service: ContentModuleService
): Promise<{ id?: string; error?: string }> {
  if (requested === undefined || requested === null || requested === "") {
    return {}
  }

  if (typeof requested !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(requested)) {
    return {
      error:
        'Campo "id" deve ser um apelido em minúsculas, sem espaços ' +
        '(letras, números e hífen): ele vira a âncora do link, como "/#hero".',
    }
  }

  // `listContentSections` (e não `retrieveContentSection`): o `retrieve` de um
  // id inexistente **lança** um 404 do Medusa ("ContentSection with id: x was
  // not found"), e aqui o caso "não existe" é o caminho feliz.
  const taken = await service.listContentSections({ id: requested })

  if (taken.length) {
    return { error: `Já existe uma seção com o id "${requested}".` }
  }

  return { id: requested }
}
