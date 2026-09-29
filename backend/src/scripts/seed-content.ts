import { ExecArgs } from "@medusajs/framework/types"

import { CONTENT_MODULE } from "../modules/content"
import { restoreDefaultSections } from "../modules/content/restore"
import type ContentModuleService from "../modules/content/service"
import { scriptFlags } from "./flags"

/**
 * Popula o módulo de conteúdo com a cópia do protótipo — a vitrine padrão.
 *
 * Rode com:
 *   ./node_modules/.bin/medusa exec ./src/scripts/seed-content.ts
 *   yarn seed-content        (o `make seed` também o chama)
 *
 * Cria apenas as seções que ainda não existem (comparando por `id`) e não
 * encosta no que o admin já editou. **A regra é a mesma que o botão "Restaurar
 * padrão" do CRM usa** (`modules/content/restore.ts`): duas cópias dela
 * divergiriam no dia em que o conteúdo padrão mudasse, e a loja de quem usou o
 * script ficaria diferente da de quem clicou no painel.
 *
 * `--force` remove as seções existentes da superfície antes de recriar tudo do
 * zero, sobrescrevendo o que o admin tenha editado. É o único caminho
 * destrutivo, e é de propósito que ele só exista aqui: no CRM, apagar conteúdo
 * do lojista tem que ser uma ação por seção, com o nome dela na confirmação.
 */
export default async function seedContent({
  container,
  args,
}: ExecArgs & { args?: string[] }) {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)
  const surface = "home"

  if (scriptFlags(args).includes("--force")) {
    const existing = await service.listContentBlocks({ surface })

    if (existing.length) {
      await service.deleteContentBlocks(existing.map((block) => block.id))
      console.log(`Removidas ${existing.length} seção(ões) existentes.`)
    }
  }

  const { created, kept } = await restoreDefaultSections(service, { surface })

  console.log(
    created.length
      ? `Criadas ${created.length} seção(ões) em "${surface}": ${created.join(
          ", "
        )}. Já existiam ${kept}, nenhuma alterada.`
      : `Já existem ${kept} seção(ões) em "${surface}" — nenhuma faltando. ` +
          `Nada foi alterado; use --force para recriar do zero.`
  )
}
