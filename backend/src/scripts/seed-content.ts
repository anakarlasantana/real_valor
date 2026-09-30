import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../modules/content"
import { THEME_SURFACE } from "../modules/content/contract"
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
 * Popula as **duas** superfícies de conteúdo: a vitrine (`home`, as seções do
 * protótipo) e o tema (`theme`, as estações — a mesma lista que o gerador
 * escreve em `frontend/themes/<id>/theme.json`). As duas passam pela mesma
 * regra (`restoreDefaultSections`, em `modules/content/restore.ts`), porque as
 * duas são `content_section`: o que muda entre elas é só a lista de padrão.
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
  const force = scriptFlags(args).includes("--force")

  // As **duas** superfícies de conteúdo. A lista é explícita (e não
  // `CONTENT_SURFACES`) porque o que cada uma repõe é decidido por
  // `defaultsFor` (`modules/content/restore.ts`): uma superfície nova no
  // contrato precisa do padrão dela declarado lá antes de entrar aqui — sem
  // isso o `make seed` criaria o conteúdo da vitrine debaixo da superfície
  // nova, que é o defeito que o `defaultsFor` documenta.
  for (const surface of ["home", THEME_SURFACE]) {
    if (force) {
      const existing = await service.listContentSections({ surface })

      if (existing.length) {
        await service.deleteContentSections(
          existing.map((section) => section.id)
        )
        console.log(
          `Removidas ${existing.length} linha(s) existentes em "${surface}".`
        )
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
            (chips.length
              ? ` Chips padrão ligados em: ${chips.join(", ")}.`
              : "")
        : `Já existem ${kept} seção(ões) em "${surface}" — nenhuma faltando. ` +
            `Nada foi alterado; use --force para recriar do zero.`
    )
  }

  // E o fecho da conversão dos chips de **texto** (as bases anteriores à R1): a
  // chave antiga sai do `data` — ela não é campo de contrato há dois passos, e o
  // `PATCH` mescla o `data`, então ficaria lá para sempre — e a seção que ficou
  // sem chips no link recebe os do padrão. Numa base já convertida isso não
  // grava nada (ver `retireTextFilters`, em `modules/content/filters.ts`).
  //
  // A linha **crua** (`listContentSections`), e não a achatada (`listSections`):
  // quem sabe onde a chave mora é o `data`, e é ele que a conversão reescreve —
  // `listSections` desaninha o `data` no nível raiz e ali não há o que limpar.
  //
  // Só a vitrine: os chips são referência do campo `filters`, que nenhum tipo
  // da superfície de tema declara.
  const { cleaned, chipped } = await retireTextFilters({
    service,
    link,
    query,
    sections: await service.listContentSections({ surface: "home" }),
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
