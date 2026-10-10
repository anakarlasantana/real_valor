import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../modules/content"
import { PAGE_SURFACES, THEME_SURFACE } from "../modules/content/contract"
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
 * Popula as superfícies de conteúdo: a vitrine (`home`, as seções do
 * protótipo), o tema (`theme`, as estações — a mesma lista que o gerador escreve
 * em `frontend/themes/<id>/theme.json`) e **cada página declarada**
 * (`PAGE_SURFACES`: `/sobre`, `/trocas-e-devolucoes`, …). Todas passam pela
 * mesma regra (`restoreDefaultSections`, em `modules/content/restore.ts`),
 * porque todas são `content_section`: o que muda entre elas é só a lista de
 * padrão — e a das páginas é vazia hoje, de propósito, porque a copy de uma
 * página institucional é do negócio e não do seed.
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

  // As superfícies de conteúdo: a vitrine, o tema e **cada página declarada**
  // (F1 do doc 14).
  //
  // A vitrine e o tema são explícitos porque o que cada um repõe é decidido por
  // `defaultsFor` (`modules/content/restore.ts`): eles precisam do padrão
  // declarado lá antes de entrar aqui — sem isso o `make seed` criaria o
  // conteúdo da vitrine debaixo de uma superfície que não o desenha, que é o
  // defeito que o `defaultsFor` documenta.
  //
  // As páginas entram pela lista **derivada** do contrato (`PAGE_SURFACES`): uma
  // página nova passa a nascer semeada sem que este arquivo seja editado. O
  // padrão dela (hoje vazio, de propósito — a copy das páginas é do negócio) sai
  // do mesmo `defaultsFor`, então "Restaurar padrão" e o seed continuam sendo a
  // mesma resposta para a mesma pergunta.
  for (const surface of [
    "home",
    THEME_SURFACE,
    ...PAGE_SURFACES.map((page) => page.id),
  ]) {
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
