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
 * **A seção criada nasce completa**, e isso inclui os chips: eles são
 * referência (o link `content_section_category`), não conteúdo, então não
 * podem viajar na linha do `data` — o segundo passo (`writeDefaultChips`)
 * liga as categorias padrão na seção que acabou de nascer. Uma seção criada
 * pela metade seria uma vitrine que o lojista não pediu: "Peças em destaque"
 * sem nenhum chip mostra o catálogo inteiro.
 *
 * A fonte é **a lista da superfície**: `DEFAULT_HOME_SECTIONS`
 * (`defaults.ts`) para a vitrine — a mesma do fallback da loja —, e
 * `THEME_SECTIONS` (`themes.ts`) para o tema, que é o mesmo dado que o gerador
 * escreve nos `theme.json`. Uma terceira lista de conteúdo padrão seria mais um
 * lugar para divergir, e é por isso que a escolha entre as duas é uma função
 * só (`defaultsFor`).
 *
 * As seções criadas nascem com a **coluna `fixed`** resolvida (ver
 * `models/content-section.ts`): o bloco ancorado nasce fixo — o cromo do site e
 * a abertura da home (a capa e a faixa de benefícios) não têm ordem —, e o resto
 * nasce solto, numerado. É o padrão que também vale para o
 * `POST /admin/content` — as duas portas que criam seção respondem a mesma
 * pergunta do mesmo jeito.
 */
import {
  FIXED_SECTION_POSITIONS,
  THEME_SURFACE,
  findSurface,
  isSingletonSectionType,
} from "./contract"
import type { QueryGraph, RemoteLink } from "./curation"
import { DEFAULT_HOME_SECTIONS, DEFAULT_PAGE_SECTIONS } from "./defaults"
import { hasChips, writeDefaultChips } from "./filters"
import { DEFAULT_SURFACE, positionAfter } from "./order"
import type ContentModuleService from "./service"
import { THEME_SECTIONS, type ThemeSection } from "./themes"

export type RestoreResult = {
  /** Os `id` das seções criadas, na ordem do padrão. */
  created: string[]
  /** Quantas já existiam (não foram tocadas). */
  kept: number
  /**
   * Os `id` das seções criadas que receberam os chips **padrão**.
   *
   * É a parte da seção que não mora no `data`: os chips são referência (o link
   * `content_section_category`), então não viajam na linha criada lá em cima —
   * precisam de um segundo passo, com o id da seção que acabou de nascer. Vem
   * na resposta porque a operação diz o que fez: uma seção criada sem chips
   * seria uma vitrine com o catálogo inteiro, e ninguém saberia por quê.
   */
  chips: string[]
}

/**
 * As seções padrão de uma superfície — a **única** coisa que muda entre elas.
 *
 * A vitrine repõe `DEFAULT_HOME_SECTIONS` (`./defaults`) e o tema repõe
 * `THEME_SECTIONS` (`./themes`); o resto do caminho é o mesmo: quais faltam,
 * onde entram e o que fazer com as que já existem. Sem esta escolha, o botão
 * "Restaurar padrão" aberto na aba do tema criaria `nav`, `hero` e o rodapé
 * **dentro** da superfície `theme` — blocos que nenhum render daquela
 * superfície lê, e que apareceriam como lixo na lista de estações.
 *
 * Uma **página** repõe `DEFAULT_PAGE_SECTIONS[id]` — que hoje é vazio de
 * propósito (ver o comentário no contrato), e é o que fecha o **defeito 1 do
 * doc 14**: antes desta linha, "Restaurar padrão" aberto na aba de `/trocas`
 * criava a vitrine inteira dentro da página de trocas (anúncio, cabeçalho,
 * capa, benefícios e rodapé) e o painel anunciava sucesso. Uma página vazia não
 * repõe nada, e uma página vazia responde 404 — que é a verdade.
 *
 * A escolha é pelo `kind` da superfície (`findSurface`), e não por uma lista de
 * `id` de página escrita aqui: uma página nova no contrato cai no ramo certo sem
 * que ninguém edite este arquivo.
 *
 * Uma superfície desconhecida cai no padrão da vitrine: a API já recusa o
 * `surface` que não existe (`resolveSurface`), então este ramo é a última
 * defesa de uma chamada por script — repor a vitrine é melhor do que não fazer
 * nada em silêncio.
 */
export function defaultsFor(surface: string): readonly ThemeSection[] {
  if (findSurface(surface)?.kind === "page") {
    return DEFAULT_PAGE_SECTIONS[surface] ?? []
  }

  return surface === THEME_SURFACE ? THEME_SECTIONS : DEFAULT_HOME_SECTIONS
}

/**
 * A posição com que cada seção que falta entra.
 *
 * Função pura e exportada para ser lida por teste: a decisão aqui é a que dava
 * errado em silêncio (a seção nova nascendo antes do hero numa base que já
 * tinha passado pelo "Salvar ordem").
 *
 * A numeração do padrão é a das **casas** da home — `announcement` 1, `nav` 2,
 * `hero` 3, `benefits` 4, `lancamentos` 5… —, e ela **só vale** enquanto a base
 * está nessa numeração. Numa base antiga (vitrine em 100, 110, 120…, ou em 20,
 * 30, 40… antes disso) copiar 5 dali põe a seção no lugar errado da página.
 *
 * A regra: a seção entra **logo depois** do vizinho que ela tem no padrão, na
 * ordem atual (`positionAfter`, que devolve a primeira casa livre da faixa). Sem
 * vizinho anterior — é a primeira da lista, ou a base está vazia —, vale a
 * posição do padrão.
 *
 * As posições planejadas contam como vizinhas: restaurar uma base vazia cria a
 * lista inteira de uma vez, e a segunda seção já enxerga a primeira.
 */
export function planRestoredPositions(
  existing: readonly { id: string; position: number }[],
  defaults: readonly {
    id: string
    position: number
    type: string
  }[] = DEFAULT_HOME_SECTIONS,
  surface: string = DEFAULT_SURFACE
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
    // A seção ancorada **não** entra "depois do vizinho": ela tem casa própria
    // (`FIXED_SECTION_POSITIONS`), e é essa casa que a loja lê sempre. Sem esta
    // linha, restaurar uma base vazia empurrava o rodapé para depois da última
    // seção — a casa 10 é ancorada, e `positionAfter` a pula por definição.
    const anchored = isSingletonSectionType(section.type)
      ? FIXED_SECTION_POSITIONS[section.type]
      : undefined
    const position =
      anchored ??
      (anchor === undefined
        ? section.position
        : positionAfter(positions, anchor, surface))

    placed.set(section.id, position)
    positions.push({ position })

    return { id: section.id, position }
  })
}

export async function restoreDefaultSections(
  service: ContentModuleService,
  {
    surface = "home",
    link,
    query,
  }: { surface?: string; link?: RemoteLink; query?: QueryGraph } = {}
): Promise<RestoreResult> {
  const existing = await service.listSections({ surface, onlyEnabled: false })
  // As seções padrão **da superfície**: a vitrine repõe o protótipo e o tema
  // repõe as estações. A lista é a mesma máquina para as duas — `position`,
  // `enabled` e o `data` achatado —, e é por isso que ela vem como parâmetro.
  const defaults = defaultsFor(surface)
  const plan = planRestoredPositions(existing, defaults, surface)
  const planned = new Map(plan.map(({ id, position }) => [id, position]))

  if (!plan.length) {
    return { created: [], kept: existing.length, chips: [] }
  }

  // `id` e `position` vêm do padrão e do plano (ver `planRestoredPositions`).
  // O resto é o `data` do tipo — inclusive o `title`, quando o tipo o tem
  // (`editorial`, `collections`…): ele é conteúdo, e não há coluna para ele
  // desde que `content_section.title` saiu.
  const missing = defaults.filter((section) => planned.has(section.id))

  await service.createContentSections(
    missing.map((section) => {
      const { id, type, enabled, position: _default, ...data } = section

      return {
        id,
        surface,
        type,
        enabled,
        position: planned.get(id) as number,
        // A seção do bloco ancorado (barra de anúncio, cabeçalho, capa, faixa de
        // benefícios e rodapé) nasce **fixa**: ela não tem ordem, e é a coluna que
        // a tela lê para mostrar "Fixo" no lugar das setas. Quem diz que o tipo é
        // ancorado é o contrato — a mesma regra que a rota do admin aplica para só
        // existir um de cada tipo.
        fixed: isSingletonSectionType(type),
        data,
      }
    })
  )

  // Os chips das seções que **nasceram agora**: o chip é referência, e o link
  // precisa da seção no banco. Só as que declaram o campo no contrato
  // (`hasChips`) — a lista de tipos sai de lá, e não daqui. Sem `link`/`query`
  // (um teste de unidade, por exemplo) a função devolve lista vazia e a seção
  // criada continua válida: sem chips, a vitrine mostra o catálogo inteiro.
  const chips = await writeDefaultChips({
    link,
    query,
    sectionIds: missing.filter((section) => hasChips(section.type)).map(({ id }) => id),
  })

  return {
    created: missing.map((section) => section.id),
    kept: existing.length,
    chips,
  }
}
