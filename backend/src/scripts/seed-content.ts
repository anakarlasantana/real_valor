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
 * É idempotente por padrão: se já existir qualquer seção para a
 * superfície, não faz nada e avisa. Assim pode ser rodado no
 * provisionamento sem sobrescrever conteúdo que o admin já editou.
 *
 * `--force` remove as seções existentes da superfície antes de recriar.
 */
export default async function seedContent({
  container,
  args,
}: ExecArgs & { args?: string[] }) {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)

  const force = (args ?? []).includes("--force")
  const surface = "home"

  const existing = await service.listContentBlocks({ surface })

  if (existing.length && !force) {
    console.log(
      `Já existem ${existing.length} seção(ões) para "${surface}". ` +
        `Nada foi alterado — use --force para recriar.`
    )
    return
  }

  if (existing.length && force) {
    await service.deleteContentBlocks(existing.map((block) => block.id))
    console.log(`Removidas ${existing.length} seção(ões) existentes.`)
  }

  const created = await service.createContentBlocks(
    DEFAULT_HOME_SECTIONS.map((section) => {
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
    `Criadas ${created.length} seções para "${surface}": ` +
      created
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((block) => `${block.position}:${block.type}`)
        .join(", ")
  )
}
