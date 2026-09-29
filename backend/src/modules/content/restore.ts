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
 *
 * As seções criadas nascem com a **coluna `fixed`** resolvida (ver
 * `models/content-section.ts`): o cromo do site nasce fixo — ele não tem ordem
 * —, e a vitrine nasce solta, numerada. É o padrão que também vale para o
 * `POST /admin/content` — as duas portas que criam seção respondem a mesma
 * pergunta do mesmo jeito.
 */
import { isSingletonSectionType } from "./contract"
import { DEFAULT_HOME_SECTIONS } from "./defaults"
import { positionAfter } from "./order"
import type ContentModuleService from "./service"

export type RestoreResult = {
  /** Os `id` das seções criadas, na ordem do padrão. */
  created: string[]
  /** Quantas já existiam (não foram tocadas). */
  kept: number
}

/**
 * A posição com que cada seção que falta entra.
 *
 * Função pura e exportada para ser lida por teste: a decisão aqui é a que dava
 * errado em silêncio (a seção nova nascendo antes do hero numa base que já
 * tinha passado pelo "Salvar ordem").
 *
 * A numeração do padrão é a do protótipo — `nav` 5, `announcement` 10, `hero`
 * 20, `lancamentos` 25… — e **só vale** enquanto a base está nessa numeração.
 * Depois de uma gravação de ordem no CRM a vitrine está em 100, 110, 120…, e
 * copiar 25 dali põe a seção no lugar errado da página.
 *
 * A regra: a seção entra **logo depois** do vizinho que ela tem no padrão, na
 * ordem atual (`positionAfter`, que usa a metade do vão). Sem vizinho anterior
 * — é a primeira da lista, ou a base está vazia —, vale a posição do padrão.
 *
 * As posições planejadas contam como vizinhas: restaurar uma base vazia cria a
 * lista inteira de uma vez, e a segunda seção já enxerga a primeira.
 */
export function planRestoredPositions(
  existing: readonly { id: string; position: number }[],
  defaults: readonly { id: string; position: number }[] = DEFAULT_HOME_SECTIONS
): { id: string; position: number }[] {
  const present = new Set(existing.map((section) => section.id))
  const missing = defaults.filter((section) => !present.has(section.id))

  if (!missing.length) {
    return []
  }

  const placed = new Map(existing.map((section) => [section.id, section.position]))
  const positions = existing.map((section) => ({ position: section.position }))

  return missing.map((section) => {
    const index = defaults.findIndex((candidate) => candidate.id === section.id)
    const anchorId = [...defaults.slice(0, index)]
      .reverse()
      .find((candidate) => placed.has(candidate.id))?.id
    const anchor = anchorId === undefined ? undefined : placed.get(anchorId)
    const position =
      anchor === undefined ? section.position : positionAfter(positions, anchor)

    placed.set(section.id, position)
    positions.push({ position })

    return { id: section.id, position }
  })
}

export async function restoreDefaultSections(
  service: ContentModuleService,
  { surface = "home" }: { surface?: string } = {}
): Promise<RestoreResult> {
  const existing = await service.listSections({ surface, onlyEnabled: false })
  const plan = planRestoredPositions(existing)
  const planned = new Map(plan.map(({ id, position }) => [id, position]))

  if (!plan.length) {
    return { created: [], kept: existing.length }
  }

  // `id` e `position` vêm do padrão e do plano (ver `planRestoredPositions`).
  // O resto é o `data` do tipo — inclusive o `title`, quando o tipo o tem
  // (`editorial`, `collections`…): ele é conteúdo, e não há coluna para ele
  // desde que `content_section.title` saiu.
  const missing = DEFAULT_HOME_SECTIONS.filter((section) =>
    planned.has(section.id)
  )

  await service.createContentSections(
    missing.map((section) => {
      const { id, type, enabled, position: _default, ...data } = section

      return {
        id,
        surface,
        type,
        enabled,
        position: planned.get(id) as number,
        // A seção do cromo (barra de anúncio, cabeçalho, rodapé) nasce **fixa**:
        // ela não tem ordem, e é a coluna que a tela lê para mostrar "Fixo" no
        // lugar do numeral e não oferecer as setas. Quem diz que o tipo é cromo é
        // o contrato — a mesma regra que a rota do admin aplica para só existir
        // um de cada tipo.
        fixed: isSingletonSectionType(type),
        data,
      }
    })
  )

  return {
    created: missing.map((section) => section.id),
    kept: existing.length,
  }
}
