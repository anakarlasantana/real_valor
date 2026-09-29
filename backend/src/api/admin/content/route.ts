import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../modules/content"
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
  }: { strict: boolean; fields: ContentSchemaPayload["fields"] }
): string[] {
  const errors: string[] = []
  // `?? []` e a checagem abaixo existem por causa de um caso real: a entrada
  // `footer` saiu de `SECTION_FIELDS` e o `map` estourava com 500 ("Cannot
  // read properties of undefined"), que para o lojista é só "ocorreu um erro
  // desconhecido" — e nenhum guard reprovava, porque a paridade tolera a
  // chave faltando dos dois lados. Tipo sem campos é bug de contrato, não
  // dado ruim: melhor uma mensagem que aponta o arquivo.
  // Os campos vêm do **registro no banco** (`service.getSchema()`), e não do
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

  for (const spec of specs) {
    const present = Object.prototype.hasOwnProperty.call(data, spec.name)
    const value = data[spec.name]

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
 * Os nomes dos campos de `data` de um tipo, como o **registro** os declara.
 *
 * É o que `splitPayload` precisa para desempatar uma chave que é coluna e
 * campo de conteúdo ao mesmo tempo (`title`, em quatro tipos): quem decide é o
 * schema do tipo, não o nome da chave. Ver `modules/content/payload.ts`.
 */
function fieldNamesOf(
  type: string,
  fields: ContentSchemaPayload["fields"]
): ReadonlySet<string> {
  return new Set((fields[type] ?? []).map((field) => field.name))
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
  type: string
  data: unknown
}) {
  return {
    id: block.id,
    enabled: block.enabled,
    position: block.position,
    type: block.type,
    ...((block.data ?? {}) as Record<string, unknown>),
  }
}

/**
 * GET /admin/content — todas as seções, inclusive desabilitadas.
 *
 * Diferente da rota pública, aqui não se filtra `enabled`, porque o
 * admin precisa listar (e reabilitar) o que está oculto.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const { surface = "home" } = req.query as { surface?: string }
  const sections = await service.listSections({ surface, onlyEnabled: false })
  const stored = await service.getSchema()

  res.json({
    sections,
    /**
     * Metadados que o widget usa para montar o formulário — lidos do
     * **registro no Postgres** (`service.getSchema()`), que é o mesmo lugar de
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

  // `listContentBlocks` (e não `retrieveContentBlock`): o `retrieve` de um id
  // inexistente **lança** um 404 do Medusa ("ContentBlock with id: x was not
  // found"), e aqui o caso "não existe" é o caminho feliz.
  const taken = await service.listContentBlocks({ id: requested })

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

  const body = (req.body ?? {}) as Record<string, unknown>
  const type = body.type
  /** A superfície onde a seção nasce (`home`, o padrão do modelo). */
  const surface = typeof body.surface === "string" ? body.surface : "home"

  const { schema } = await service.getSchema()

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

  const { columns, data: sent } = splitPayload(
    body,
    fieldNamesOf(type, schema.fields)
  )

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

  const created = await service.createContentBlocks({
    ...(sectionId ? { id: sectionId } : {}),
    ...columns,
    position,
    type,
    data,
  })

  notifyStorefront(req)

  res.status(201).json({ section: toSection(created) })
}

/** PATCH /admin/content?id=... — atualiza uma seção existente. */
export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const { id } = req.query as { id?: string }

  if (!id) {
    res.status(400).json({
      type: "invalid_data",
      message: 'Query param "id" é obrigatório.',
    })
    return
  }

  const existing = await service.retrieveContentBlock(id)

  if (!existing) {
    res
      .status(404)
      .json({ type: "not_found", message: "Seção não encontrada." })
    return
  }

  const { schema } = await service.getSchema()
  const type = existing.type

  if (!isKnownType(type, schema)) {
    res.status(500).json({
      type: "invalid_data",
      message: `Seção "${id}" tem type inválido gravado: "${existing.type}".`,
    })
    return
  }

  const { columns, data } = splitPayload(
    (req.body ?? {}) as Record<string, unknown>,
    fieldNamesOf(type, schema.fields)
  )

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
  })

  if (errors.length) {
    res.status(400).json({ type: "invalid_data", message: errors.join(" ") })
    return
  }

  const updated = await service.updateContentBlocks({
    id,
    ...columns,
    ...(position !== undefined ? { position } : {}),
    ...(Object.keys(data).length
      ? { data: { ...(existing.data ?? {}), ...data } }
      : {}),
  })

  notifyStorefront(req)

  res.json({ section: toSection(updated) })
}

/** DELETE /admin/content?id=... — remove uma seção. */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const { id } = req.query as { id?: string }

  if (!id) {
    res.status(400).json({
      type: "invalid_data",
      message: 'Query param "id" é obrigatório.',
    })
    return
  }

  await service.deleteContentBlocks(id)

  notifyStorefront(req)

  res.json({ id, object: "content_block", deleted: true })
}
