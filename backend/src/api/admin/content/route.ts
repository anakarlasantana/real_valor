import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../modules/content"
import {
  readCuration,
  withCuration,
  writeCuration,
  type RemoteLink,
} from "../../../modules/content/curation"
import { isSingletonSectionType } from "../../../modules/content/contract"
import { DEFAULT_SECTION_DATA } from "../../../modules/content/defaults"
import {
  FILTERS_FIELD,
  readCategoryCatalog,
  readChips,
  withFilters,
  writeFilters,
} from "../../../modules/content/filters"
import { nextPosition } from "../../../modules/content/order"
import { splitPayload } from "../../../modules/content/payload"
import {
  readPosition,
  resolveCategoryIds,
  resolveProductIds,
  resolveSectionId,
} from "../../../modules/content/resolvers"
import { notifyStorefront } from "../../../modules/content/revalidate"
import type ContentModuleService from "../../../modules/content/service"
import {
  isKnownType,
  validateData,
} from "../../../modules/content/validation"
import { toSection } from "../../../modules/content/view"

/**
 * GET /admin/content — todas as seções, inclusive desabilitadas.
 *
 * Diferente da rota pública, aqui não se filtra `enabled`, porque o
 * admin precisa listar (e reabilitar) o que está oculto.
 *
 * A curadoria vem junto, e vem **sempre que existe**: o painel edita a lista, e
 * `productIds` ausente é "esta seção não tem curadoria" (o tipo que lista o
 * catálogo sozinho).
 *
 * Os chips também, e pelo mesmo motivo — com uma diferença: lá o `filters` **é**
 * campo do formulário (o seletor de categorias), então o que a tela devolve no
 * "Salvar" é a mesma lista de ids, e o catálogo que a alimenta viaja em
 * `categories`.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { surface = "home" } = req.query as { surface?: string }
  const sections = await service.listSections({ surface, onlyEnabled: false })
  const sectionIds = sections.map((section) => section.id)
  const curation = await readCuration(query, sectionIds)
  // A leitura dos chips é a mesma do storefront (`readChips`): o id é a
  // referência que a seção guarda e o nome/`handle` são lidos agora, para a
  // tela mostrar o nome que a categoria tem hoje — e não o texto que alguém
  // digitou quando montou a vitrine.
  const chips = await readChips(query, sectionIds)
  const stored = await service.getContract()

  res.json({
    sections: sections.map((section) =>
      withFilters(withCuration(section, curation[section.id]), chips[section.id])
    ),
    /**
     * O catálogo de categorias, para o seletor de chips — o que a seção **pode**
     * escolher.
     *
     * Vem do catálogo, e não de um `options` no contrato: a lista de categorias
     * é dado do banco (o lojista cria e apaga no painel do Medusa), e uma lista
     * fechada no contrato ofereceria categorias que não existem — que é
     * exatamente o defeito que a fase conserta (o chip "Blazers", que não tinha
     * categoria por trás e devolvia zero peças em silêncio).
     */
    categories: await readCategoryCatalog(query),
    /**
     * Metadados que o widget usa para montar o formulário — lidos do
     * **registro no Postgres** (`service.getContract()`), que é o mesmo lugar de
     * onde o `seed-schema` tira a linha. A montagem a partir do contrato
     * (`buildSchema()`, em `modules/content/schema.ts`) é o bootstrap: só entra
     * quando o registro não existe, e o `schemaSource` abaixo diz qual dos
     * dois foi servido.
     */
    schema: stored.schema,
    /**
     * A versão do schema com que estes dados foram escritos — a loja recebe
     * isto no payload da Store API para saber com qual formulário foram
     * gravados.
     */
    schemaVersion: stored.version,
    /**
     * De onde veio o schema: `"db"` é o registro no Postgres (o caso normal
     * depois do `make seed`), `"contract"` é o bootstrap do contrato, para um
     * banco que ainda não foi semeado. Não é depuração: é o que torna visível
     * que o registro ainda não foi gravado.
     */
    schemaSource: stored.source,
  })
}

/** POST /admin/content — cria uma seção. */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const link: RemoteLink = req.scope.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  )

  const body = (req.body ?? {}) as Record<string, unknown>
  const type = body.type
  /** A superfície onde a seção nasce (`home`, o padrão do modelo). */
  const surface = typeof body.surface === "string" ? body.surface : "home"

  const { schema } = await service.getContract()

  if (!isKnownType(type, schema)) {
    res.status(400).json({
      type: "invalid_data",
      message: `Campo "type" deve ser um de: ${schema.types.join(", ")}.`,
    })
    return
  }

  // A lista serve para duas coisas abaixo: a unicidade do cromo e a posição de
  // quem chega no fim (uma leitura só).
  const sections = await service.listSections({ surface, onlyEnabled: false })

  // Cromo do site (`nav`, `footer`, barra de anúncio) só existe uma vez: o
  // layout resolve os três por `find`, então uma segunda seção do mesmo tipo
  // seria uma linha que o CRM lista e a loja **nunca** desenha — parece que
  // funcionou, e por isso é pior que um erro. Ver
  // `SINGLETON_SECTION_TYPES` no contrato.
  if (
    isSingletonSectionType(type) &&
    sections.some((section) => section.type === type)
  ) {
    res.status(400).json({
      type: "invalid_data",
      message:
        `Já existe uma seção do tipo "${type}" em "${surface}". ` +
        `Ele é único — é "${schema.typeLabels[type] ?? type}", que a loja ` +
        `desenha em todas as rotas: edite a seção existente.`,
    })
    return
  }

  const { columns, data: sent, curation, references } = splitPayload(body)

  const { ids: productIds, error: curationError } = await resolveProductIds(
    curation,
    query
  )

  if (curationError) {
    res.status(400).json({ type: "invalid_data", message: curationError })
    return
  }

  const { ids: categoryIds, error: filtersError } = await resolveCategoryIds(
    references?.[FILTERS_FIELD],
    query
  )

  if (filtersError) {
    res.status(400).json({ type: "invalid_data", message: filtersError })
    return
  }

  // A seção nova nasce com o conteúdo padrão do tipo e o que veio no corpo por
  // cima (`DEFAULT_SECTION_DATA`). Sem isso, criar exigiria os campos
  // obrigatórios de uma seção que ainda não existe — pedir o título do hero
  // antes de o lojista ver a seção na lista.
  const data = { ...(DEFAULT_SECTION_DATA[type] ?? {}), ...sent }

  // Sem `position` no corpo, a seção nova entra no FIM. O default da coluna é
  // `0`, que na loja significa **primeira** — uma seção criada por script
  // apareceria no topo da home sem ninguém ter pedido. O CRM sempre manda a
  // posição; isto é para quem chama a API direto.
  const { position: sentPosition, error: positionError } = readPosition(
    columns.position
  )

  if (positionError) {
    res.status(400).json({ type: "invalid_data", message: positionError })
    return
  }

  // A posição vem da **regra do módulo** (`order.ts`), e não de uma cópia
  // local: era o `nextPosition` duplicado aqui — uma segunda resposta para a
  // mesma pergunta. A regra tem o piso da faixa da vitrine, que é o que impede a
  // seção nova de nascer no meio do cromo (o `fixed` mora abaixo dela), e ela
  // recebe **só a vitrine**: o cromo não conta, porque a posição dele não decide
  // nada (a loja resolve o cromo por `type`).
  const position =
    sentPosition ?? nextPosition(sections.filter((section) => !section.fixed))

  const errors = validateData(type, data, {
    strict: true,
    fields: schema.fields,
    references,
  })

  if (errors.length) {
    res.status(400).json({ type: "invalid_data", message: errors.join(" ") })
    return
  }

  const { id: sectionId, error } = await resolveSectionId(body.id, service)

  if (error) {
    res.status(400).json({ type: "invalid_data", message: error })
    return
  }

  const created = await service.createContentSections({
    ...(sectionId ? { id: sectionId } : {}),
    ...columns,
    position,
    // A seção do cromo nasce **fixa** (sem ordem), como no seed/`Restaurar
    // padrão`: é a coluna que a tela lê para mostrar "Fixo" no lugar do numeral
    // e não oferecer as setas. O tipo que responde é o do contrato — a mesma
    // regra da unicidade logo acima (`SINGLETON_SECTION_TYPES`) —, e o corpo pode
    // dizer outra coisa: `fixed` é coluna, como `enabled`, e o que veio manda.
    fixed:
      typeof columns.fixed === "boolean"
        ? columns.fixed
        : isSingletonSectionType(type),
    type,
    data,
  })

  // A curadoria é gravada **depois** da seção: o link precisa do id dela (que
  // pode ter vindo do corpo ou do banco). Se esta chamada falhar, a seção fica
  // sem curadoria — e é isso que o CRM diz, porque a resposta abaixo só traz
  // `productIds` quando a gravação deu certo.
  if (productIds?.length) {
    await writeCuration({ link, query, sectionId: created.id, productIds })
  }

  // E os chips, pela mesma ordem e pelo mesmo motivo: o link precisa do id da
  // seção, e uma falha aqui deixa a seção sem chips (o catálogo inteiro na
  // vitrine) em vez de com uma lista pela metade.
  if (categoryIds?.length) {
    await writeFilters({ link, query, sectionId: created.id, categoryIds })
  }

  notifyStorefront(req.scope)

  res.status(201).json({
    // Os chips da resposta são **relidos** quando o corpo os trouxe: é a mesma
    // verdade da curadoria (a resposta diz o que ficou gravado, com o nome da
    // categoria que a tela vai desenhar).
    section: withFilters(
      withCuration(toSection(created), productIds),
      categoryIds?.length
        ? (await readChips(query, [created.id]))[created.id]
        : undefined
    ),
  })
}

/** PATCH /admin/content?id=... — atualiza uma seção existente. */
export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const link: RemoteLink = req.scope.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  )

  const { id } = req.query as { id?: string }

  if (!id) {
    res.status(400).json({
      type: "invalid_data",
      message: 'Query param "id" é obrigatório.',
    })
    return
  }

  const existing = await service.retrieveContentSection(id)

  if (!existing) {
    res
      .status(404)
      .json({ type: "not_found", message: "Seção não encontrada." })
    return
  }

  const { schema } = await service.getContract()
  const type = existing.type

  if (!isKnownType(type, schema)) {
    res.status(500).json({
      type: "invalid_data",
      message: `Seção "${id}" tem type inválido gravado: "${existing.type}".`,
    })
    return
  }

  const { columns, data, curation, references } = splitPayload(
    (req.body ?? {}) as Record<string, unknown>
  )

  const { ids: productIds, error: curationError } = await resolveProductIds(
    curation,
    query
  )

  if (curationError) {
    res.status(400).json({ type: "invalid_data", message: curationError })
    return
  }

  const { ids: categoryIds, error: filtersError } = await resolveCategoryIds(
    references?.[FILTERS_FIELD],
    query
  )

  if (filtersError) {
    res.status(400).json({ type: "invalid_data", message: filtersError })
    return
  }

  // `position` passa pela mesma conferência do POST: `Number("abc")` é `NaN`, e
  // `NaN` na coluna não dá erro — dá ordem indefinida na loja, que é o defeito
  // que a renumeração do CRM existe para evitar.
  const { position, error: positionError } = readPosition(columns.position)

  if (positionError) {
    res.status(400).json({ type: "invalid_data", message: positionError })
    return
  }

  // Numa edição parcial só se valida o que veio: mesclar com o `data`
  // atual antes de validar evitava poder limpar um campo de propósito.
  const errors = validateData(type, data, {
    strict: false,
    fields: schema.fields,
    references,
  })

  if (errors.length) {
    res.status(400).json({ type: "invalid_data", message: errors.join(" ") })
    return
  }

  const updated = await service.updateContentSections({
    id,
    ...columns,
    ...(position !== undefined ? { position } : {}),
    ...(Object.keys(data).length
      ? { data: { ...(existing.data ?? {}), ...data } }
      : {}),
  })

  // `productIds` ausente = "não mexe"; presente (mesmo `[]`) = a lista manda.
  // Quando ele não veio, a curadoria de agora é lida para a resposta dizer a
  // verdade sobre o que ficou gravado — a tela do CRM atualiza o estado com este
  // corpo, e um `productIds` faltando ali apagaria a lista na tela sem que nada
  // tivesse mudado no banco.
  const curationAfter =
    productIds ?? (await readCuration(query, [id]))[id] ?? []

  if (productIds) {
    await writeCuration({ link, query, sectionId: id, productIds })
  }

  // `filters` ausente = "não mexe"; presente (mesmo `[]`) = a lista manda. Como
  // a curadoria, a resposta traz os chips **relidos** — e aqui sempre, mesmo
  // quando o corpo não os tocou: o `filters` que o CRM manda é o id, e é o
  // objeto com nome e `handle` que a tela desenha.
  if (categoryIds) {
    await writeFilters({ link, query, sectionId: id, categoryIds })
  }

  const chipsAfter = (await readChips(query, [id]))[id]

  notifyStorefront(req.scope)

  res.json({
    section: withFilters(withCuration(toSection(updated), curationAfter), chipsAfter),
  })
}

/** DELETE /admin/content?id=... — remove uma seção. */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const link: RemoteLink = req.scope.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  )

  const { id } = req.query as { id?: string }

  if (!id) {
    res.status(400).json({
      type: "invalid_data",
      message: 'Query param "id" é obrigatório.',
    })
    return
  }

  // A curadoria vai **antes** da seção: tirar o vínculo é um soft delete
  // (`deleted_at`), e a seção some depois. Nesta ordem, uma falha no meio deixa
  // a seção inteira com a curadoria vazia — que o lojista recompõe pela tela —
  // em vez de uma seção apagada com a lista de produtos ainda ativa. Ver
  // `modules/content/curation.ts` para o que o Medusa faz em cada uma das
  // operações (nenhuma delas é `DELETE` de linha: link é estado).
  //
  // O mesmo vale para os chips (`content_section_category`): o `delete` abaixo
  // é por seção, e limpa **todos** os links dela — a curadoria e os chips —,
  // que é o que a leitura de ambos os lados espera de uma seção que não existe
  // mais. Medido no gate da R1: as duas tabelas ficam com `deleted_at`
  // preenchido depois desta chamada.
  await link.delete({ [CONTENT_MODULE]: { content_section_id: id } })
  await service.deleteContentSections(id)

  notifyStorefront(req.scope)

  res.json({ id, object: "content_section", deleted: true })
}
