/**
 * Cria as seções padrão que faltam numa superfície.
 * -------------------------------------------------------------------------
 * A regra existe **uma vez** porque tem duas portas:
 *
 *   CLI   `medusa exec ./src/scripts/seed-content.ts` — o `make seed`
 *         (uma base nova nasce com a vitrine montada, sem ninguém clicar);
 *   CRM   `POST /admin/content/restore` — o botão "Restaurar padrão", para
 *         quem apagou uma seção por engano ou adotou um banco que veio vazio.
 *
 * **Só o que falta.** Apagar tudo e recriar é um clique que destrói o trabalho
 * do lojista sem que ele possa saber o que perde — e o CRM tem a remoção por
 * seção para quem quer mexer numa só. Assim a operação é idempotente: rodar de
 * novo com tudo no lugar não muda nada.
 *
 * A fonte é `DEFAULT_HOME_SECTIONS` (`defaults.ts`), a mesma do fallback da
 * vitrine: uma terceira lista de conteúdo padrão seria mais um lugar para
 * divergir.
 */
import { DEFAULT_HOME_SECTIONS } from "./defaults"
import type ContentModuleService from "./service"

export type RestoreResult = {
  /** Os `id` das seções criadas, na ordem do padrão. */
  created: string[]
  /** Quantas já existiam (não foram tocadas). */
  kept: number
}

export async function restoreDefaultSections(
  service: ContentModuleService,
  { surface = "home" }: { surface?: string } = {}
): Promise<RestoreResult> {
  const existing = await service.listSections({ surface, onlyEnabled: false })
  const present = new Set(existing.map((section) => section.id))

  const missing = DEFAULT_HOME_SECTIONS.filter(
    (section) => !present.has(section.id)
  )

  if (!missing.length) {
    return { created: [], kept: existing.length }
  }

  // `id` e `position` vêm do padrão de propósito: são eles que o menu usa como
  // âncora (`/#hero`) e a ordem que a loja conhece. `title` não aparece aqui —
  // quando o tipo o tem (`editorial`, `collections`…), ele é conteúdo e vai
  // junto no `data`.
  await service.createContentBlocks(
    missing.map(({ id, type, enabled, position, ...data }) => ({
      id,
      surface,
      type,
      enabled,
      position,
      data,
    }))
  )

  return {
    created: missing.map((section) => section.id),
    kept: existing.length,
  }
}
