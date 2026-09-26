import { ExecArgs } from "@medusajs/framework/types"

import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"
import { DEFAULT_HOME_SECTIONS } from "../modules/content/defaults"

/**
 * Popula o módulo de conteúdo com a cópia do protótipo.
 *
 * Rode com:
 *   ./node_modules/.bin/medusa exec ./src/scripts/seed-content.ts
 *
 * É idempotente e incremental: cria apenas os blocos que ainda não
 * existem (comparando por `id`) e não encosta no que o admin já editou.
 * É por aqui que um bloco novo — como o `nav` do cabeçalho — chega numa
 * loja que já foi semeada: basta rodar de novo.
 *
 * `--force` remove as seções existentes da superfície antes de recriar
 * tudo do zero (sobrescreve edições do admin).
 */
export default async function seedContent({
  container,
  args,
}: ExecArgs & { args?: string[] }) {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)

  const force = (args ?? []).includes("--force")
  const surface = "home"

  const existing = await service.listContentBlocks({ surface })

  if (force && existing.length) {
    await service.deleteContentBlocks(existing.map((block) => block.id))
    console.log(`Removidas ${existing.length} seção(ões) existentes.`)
  }

  const kept = force ? 0 : existing.length
  const keptIds = new Set(force ? [] : existing.map((block) => block.id))
  const missing = DEFAULT_HOME_SECTIONS.filter(
    (section) => !keptIds.has(section.id)
  )

  if (!missing.length) {
    console.log(
      `Já existem ${kept} seção(ões) para "${surface}" — nenhuma faltando. ` +
        `Nada foi alterado; use --force para recriar do zero.`
    )
    return
  }

  const created = await service.createContentBlocks(
    missing.map((section) => {
      const { id, enabled, position, type, ...data } = section

      return {
        id,
        surface,
        type,
        enabled,
        position,
        data: data as Record<string, unknown>,
      }
    })
  )

  console.log(
    `Criadas ${created.length} seção(ões) para "${surface}": ` +
      created
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((block) => `${block.position}:${block.type}`)
        .join(", ") +
      (kept ? ` (${kept} já existiam e não foram tocadas)` : "")
  )
}
