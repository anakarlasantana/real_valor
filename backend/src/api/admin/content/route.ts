import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../modules/content"
import {
  CURATION_FIELD,
  readCuration,
  withCuration,
  writeCuration,
  type QueryGraph,
  type RemoteLink,
} from "../../../modules/content/curation"
import {
  FILTERS_FIELD,
  listCategoryRefs,
  readCategoryCatalog,
  readChips,
  withFilters,
  writeFilters,
} from "../../../modules/content/filters"
import {
  isSingletonSectionType,
  type FieldKind,
} from "../../../modules/content/contract"
import { DEFAULT_SECTION_DATA } from "../../../modules/content/defaults"
import { splitPayload } from "../../../modules/content/payload"
import { revalidateContent } from "../../../modules/content/revalidate"
import type { ContentSchemaPayload } from "../../../modules/content/schema"
import type ContentModuleService from "../../../modules/content/service"

/**
 * Os `kind` que guardam um valor de `options` — escolha dentro de uma lista
 * fechada. `color` e `font` são a mesma coisa que `select` para a
 * validação: mudam só no desenho do editor (bolinha de cor, lista de fontes
 * com prévia). Quem garante que eles não viram texto livre é esta lista.
 */
const CHOICE_KINDS: readonly FieldKind[] = ["select", "color", "font"]

/**
 * Validação de entrada do admin contra `contract.ts`.
 *
 * Devolve a lista de erros legíveis, ou `[]` se estiver válido.
 *
 * `strict` controla os campos obrigatórios:
 *   true  → POST. Todo campo obrigatório precisa vir no corpo.
 *   false → PATCH, que é parcial. Um campo ausente continua valendo o
 *           que já está gravado, então só se valida o que foi enviado.
 *           Exigir os obrigatórios aqui acusaria erro em qualquer
 *           edição de um campo só.
 */
function validateData(
  type: string,
  data: Record<string, unknown>,
  {
    strict,
    fields,
    references = {},
  }: {
    strict: boolean
    fields: ContentSchemaPayload["fields"]
    /**
     * Os campos de contrato que são **referência** (`filters`, os chips de
     * categoria): vieram no corpo, mas não vivem no `data` — quem os tira de lá
     * é o `splitPayload` (`modules/content/payload.ts`).
     *
     * Eles entram na conferência por dois motivos: um `filters` num tipo que não
     * tem o campo é erro (como qualquer chave desconhecida), e o `kind` do campo
     * vale para ele igual — `list:category` é lista, e uma lista que não é lista
     * é o mesmo defeito de um `items` que não é lista.
     */
    references?: Record<string, unknown>
  }
): string[] {
  const errors: string[] = []
  // `?? []` e a checagem abaixo existem por causa de um caso real: a entrada
  // `footer` saiu de `SECTION_FIELDS` e o `map` estourava com 500 ("Cannot
  // read properties of undefined"), que para o lojista é só "ocorreu um erro
  // desconhecido" — e nenhum guard reprovava, porque a paridade tolera a
  // chave faltando dos dois lados. Tipo sem campos é bug de contrato, não
  // dado ruim: melhor uma mensagem que aponta o arquivo.
  // Os campos vêm do **registro no banco** (`service.getContract()`), e não do
  // `SECTION_FIELDS` do código: é o registro que diz o que o CRM pode gravar.
  // O `contract.ts` só entra por baixo, quando o registro não existe.
  const specs = fields[type] ?? []

  if (!specs.length) {
    return [
      `O tipo "${type}" não tem campos no schema gravado ` +
        `(backend/src/modules/content/schema.ts).`,
    ]
  }

  const known = new Set(specs.map((f) => f.name))

  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      errors.push(`Campo desconhecido para "${type}": "${key}".`)
    }
  }

  // A referência passa pela mesma porta: `filters` num tipo que não declara o
  // campo é campo desconhecido — a seção não tem chips, e gravar o link dela
  // seria uma linha que nenhum render lê.
  for (const key of Object.keys(references)) {
    if (!known.has(key)) {
      errors.push(`Campo desconhecido para "${type}": "${key}".`)
    }
  }

  for (const spec of specs) {
    // O valor pode estar no `data` ou na referência — os dois chegaram no corpo,
    // e o `kind` do campo decide o que fazer com ele.
    const inData = Object.prototype.hasOwnProperty.call(data, spec.name)
    const present =
      inData || Object.prototype.hasOwnProperty.call(references, spec.name)
    const value = inData ? data[spec.name] : references[spec.name]

    // Ausente num PATCH não é erro: mantém o valor atual.
    if (!present && !strict) {
      continue
    }

    if (value === undefined || value === null || value === "") {
      if (spec.required) {
        errors.push(`Campo obrigatório ausente: "${spec.name}".`)
      }
      continue
    }

    if (spec.kind === "number") {
      if (typeof value !== "number") {
        errors.push(`Campo "${spec.name}" deve ser número.`)
      } else {
        // A faixa vem do CAMPO (`min`/`max` no contrato), não daqui: o
        // `<input>` do painel mostra a mesma, e um campo numérico novo nasce
        // com a faixa que precisa. Antes, a única faixa era a do `overlay` do
        // hero, escrita nesta função — e qualquer número novo herdava 0 a 1.
        if (typeof spec.min === "number" && value < spec.min) {
          errors.push(`Campo "${spec.name}" não pode ser menor que ${spec.min}.`)
        }

        if (typeof spec.max === "number" && value > spec.max) {
          errors.push(`Campo "${spec.name}" não pode ser maior que ${spec.max}.`)
        }
      }
    }

    if (
      CHOICE_KINDS.includes(spec.kind) &&
      !spec.options?.includes(value as never)
    ) {
      // A opção vazia não se escreve: sem o "(vazio)" a mensagem sairia
      // começando por vírgula ("deve ser um de: , rose, …").
      const options = (spec.options ?? []).map((option) =>
        option === "" ? "(vazio = padrão do tema)" : option
      )

      errors.push(`Campo "${spec.name}" deve ser um de: ${options.join(", ")}.`)
    }

    if (spec.kind.startsWith("list:") && !Array.isArray(value)) {
      errors.push(`Campo "${spec.name}" deve ser uma lista.`)
    }
  }

  return errors
}

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
async function resolveProductIds(
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
async function resolveCategoryIds(
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
 * Avisa o storefront para tirar o conteúdo do cache (`/api/revalidate`).
 *
 * Sem `await` de propósito: a gravação já está feita e a resposta ao CRM não
 * tem por que esperar o storefront. A função não lança (ver
 * `modules/content/revalidate.ts`), então não fica promise rejeitada solta.
 */
function notifyStorefront(req: MedusaRequest): void {
  void revalidateContent(req.scope.resolve(ContainerRegistrationKeys.LOGGER))
}

/** Formato de saída — achatado, igual ao da rota pública. */
function toSection(block: {
  id: string
  enabled: boolean
  position: number
  fixed: boolean
  type: string
  data: unknown
}) {
  return {
    id: block.id,
    enabled: block.enabled,
    position: block.position,
    // O CRM lê esta coluna para saber se a seção tem ordem: é ela que decide o
    // numeral × a etiqueta "Fixo" e a existência das setas (ver
    // `models/content-section.ts`).
    fixed: block.fixed,
    type: block.type,
    ...((block.data ?? {}) as Record<string, unknown>),
  }
}

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

/**
 * O `type` que a API aceita.
 *
 * Sai do **registro** (`schema.types`), não de `isSectionType`: um tipo novo
 * gravado no schema passa a ser gravável sem tocar em código — que é o ponto de
 * o schema ser dado. O contrato segue sendo o bootstrap do registro.
 */
function isKnownType(
  type: unknown,
  schema: ContentSchemaPayload
): type is string {
  return (
    typeof type === "string" &&
    (schema.types as readonly string[]).includes(type)
  )
}

/** A posição da próxima seção: depois da última, com a mesma folga do seed. */
function nextPosition(sections: { position: number }[]): number {
  return Math.max(0, ...sections.map((section) => section.position)) + 10
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
function readPosition(value: unknown): { position?: number; error?: string } {
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
async function resolveSectionId(
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

  const position = sentPosition ?? nextPosition(sections)

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

  notifyStorefront(req)

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

  notifyStorefront(req)

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

  notifyStorefront(req)

  res.json({ id, object: "content_section", deleted: true })
}
