import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import {
  SECTION_TYPES,
  SECTION_FIELDS,
  isSectionType,
  type SectionType,
} from "../../../modules/content/contract"

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
  type: SectionType,
  data: Record<string, unknown>,
  { strict }: { strict: boolean }
): string[] {
  const errors: string[] = []
  // `?? []` e a checagem abaixo existem por causa de um caso real: a entrada
  // `footer` saiu de `SECTION_FIELDS` e o `map` estourava com 500 ("Cannot
  // read properties of undefined"), que para o lojista é só "ocorreu um erro
  // desconhecido" — e nenhum guard reprovava, porque a paridade tolera a
  // chave faltando dos dois lados. Tipo sem campos é bug de contrato, não
  // dado ruim: melhor uma mensagem que aponta o arquivo.
  const specs = SECTION_FIELDS[type] ?? []

  if (!specs.length) {
    return [
      `O tipo "${type}" não tem campos em SECTION_FIELDS ` +
        `(backend/src/modules/content/contract.ts).`,
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

    if (spec.kind === "number" && typeof value !== "number") {
      errors.push(`Campo "${spec.name}" deve ser número.`)
    }

    if (spec.kind === "select" && !spec.options?.includes(value as never)) {
      errors.push(
        `Campo "${spec.name}" deve ser um de: ${spec.options?.join(", ")}.`
      )
    }

    if (spec.kind.startsWith("list:") && !Array.isArray(value)) {
      errors.push(`Campo "${spec.name}" deve ser uma lista.`)
    }
  }

  const overlay = data.overlay
  if (typeof overlay === "number" && (overlay < 0 || overlay > 1)) {
    errors.push('Campo "overlay" deve estar entre 0 e 1.')
  }

  return errors
}

/** Divide o corpo recebido entre colunas e o payload `data`. */
function splitPayload(body: Record<string, unknown>) {
  const {
    id: _id,
    title,
    enabled,
    position,
    surface,
    type: _type,
    ...data
  } = body

  return {
    columns: {
      ...(title !== undefined ? { title: title as string } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(position !== undefined ? { position: Number(position) } : {}),
      ...(surface !== undefined ? { surface: String(surface) } : {}),
    },
    data,
  }
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

  res.json({
    sections,
    /** Metadados que o widget usa para montar o formulário. */
    schema: {
      types: SECTION_TYPES,
      fields: SECTION_FIELDS,
    },
  })
}

/** POST /admin/content — cria uma seção. */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const body = (req.body ?? {}) as Record<string, unknown>
  const type = body.type

  if (!isSectionType(type)) {
    res.status(400).json({
      type: "invalid_data",
      message: `Campo "type" deve ser um de: ${SECTION_TYPES.join(", ")}.`,
    })
    return
  }

  const { columns, data } = splitPayload(body)
  const errors = validateData(type, data, { strict: true })

  if (errors.length) {
    res.status(400).json({ type: "invalid_data", message: errors.join(" ") })
    return
  }

  const created = await service.createContentBlocks({
    ...columns,
    type,
    data,
  })

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

  const type = existing.type
  if (!isSectionType(type)) {
    res.status(500).json({
      type: "invalid_data",
      message: `Seção "${id}" tem type inválido gravado: "${existing.type}".`,
    })
    return
  }

  const { columns, data } = splitPayload(
    (req.body ?? {}) as Record<string, unknown>
  )

  // Numa edição parcial só se valida o que veio: mesclar com o `data`
  // atual antes de validar evitava poder limpar um campo de propósito.
  const errors = validateData(type, data, { strict: false })

  if (errors.length) {
    res.status(400).json({ type: "invalid_data", message: errors.join(" ") })
    return
  }

  const updated = await service.updateContentBlocks({
    id,
    ...columns,
    ...(Object.keys(data).length
      ? { data: { ...(existing.data ?? {}), ...data } }
      : {}),
  })

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

  res.json({ id, object: "content_block", deleted: true })
}
