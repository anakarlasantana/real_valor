import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../modules/content"
import type { QueryGraph, RemoteLink } from "../modules/content/curation"
import { retireTextFilters } from "../modules/content/filters"
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
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const link = container.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  ) as RemoteLink
  const surface = "home"

  if (scriptFlags(args).includes("--force")) {
    const existing = await service.listContentSections({ surface })

    if (existing.length) {
      await service.deleteContentSections(existing.map((section) => section.id))
      console.log(`Removidas ${existing.length} seção(ões) existentes.`)
    }
  }

  const { created, kept, chips } = await restoreDefaultSections(service, {
    surface,
    link,
    query,
  })

  console.log(
    created.length
      ? `Criadas ${created.length} seção(ões) em "${surface}": ${created.join(
          ", "
        )}. Já existiam ${kept}, nenhuma alterada.` +
          (chips.length ? ` Chips padrão ligados em: ${chips.join(", ")}.` : "")
      : `Já existem ${kept} seção(ões) em "${surface}" — nenhuma faltando. ` +
          `Nada foi alterado; use --force para recriar do zero.`
  )

  // E o fecho da conversão dos chips de **texto** (as bases anteriores à R1): a
  // chave antiga sai do `data` — ela não é campo de contrato há dois passos, e o
  // `PATCH` mescla o `data`, então ficaria lá para sempre — e a seção que ficou
  // sem chips no link recebe os do padrão. Numa base já convertida isso não
  // grava nada (ver `retireTextFilters`, em `modules/content/filters.ts`).
  //
  // A linha **crua** (`listContentSections`), e não a achatada (`listSections`):
  // quem sabe onde a chave mora é o `data`, e é ele que a conversão reescreve —
  // `listSections` desaninha o `data` no nível raiz e ali não há o que limpar.
  const { cleaned, chipped } = await retireTextFilters({
    service,
    link,
    query,
    sections: await service.listContentSections({ surface }),
  })

  if (cleaned.length) {
    console.log(
      `Chips de texto aposentados em: ${cleaned.join(", ")}.` +
        (chipped.length
          ? ` Chips padrão ligados em: ${chipped.join(", ")}.`
          : "")
    )
  }
}
