/**
 * A ordem da vitrine — a regra que numera as seções, e a única gravação que a
 * aplica (`applyOrder`). O bloco ancorado ocupa casas que a renumeração pula; o
 * que ela protege é `position` repetida, que o lojista não conserta digitando.
 */
import { CONTENT_SURFACES, FIXED_SECTION_POSITIONS } from "./contract"
import type ContentModuleService from "./service"


/** A superfície que responde quando ninguém diz qual: a vitrine. */
export const DEFAULT_SURFACE = "home"

/**
 * A folga das **listas referenciadas** (curadoria e chips), não das seções: o
 * seed as numera de 10 em 10, e `FIRST_LIST_POSITION` sai daqui.
 */
export const POSITION_STEP = 10

/**
 * A faixa de casas de uma superfície, como o **dado** do CRM. `reserved` são as
 * casas ancoradas, que a numeração pula: o painel precisa do mesmo numeral.
 */
export type OrderFaixa = {
  first: number
  step: number
  reserved: readonly number[]
}

/** A faixa da superfície, como o contrato a declara (a primeira, se não for ela). */
export function bandFor(surface: string = DEFAULT_SURFACE): {
  first: number
  step: number
} {
  const spec = CONTENT_SURFACES.find((candidate) => candidate.id === surface)

  return (spec ?? CONTENT_SURFACES[0]).order
}

/**
 * As casas ancoradas de uma superfície — as dos **tipos que ela tem**, tiradas
 * da própria superfície: o tema não cria bloco fixo e responde sozinho.
 */
export function reservedPositions(surface: string = DEFAULT_SURFACE): number[] {
  const types = new Set(
    (
      CONTENT_SURFACES.find((candidate) => candidate.id === surface) ??
      CONTENT_SURFACES[0]
    ).types
  )

  return Object.entries(FIXED_SECTION_POSITIONS)
    .filter(([type]) => types.has(type))
    .map(([, position]) => position)
    .sort((a, b) => a - b)
}

/**
 * A casa de número `place` da faixa — a primeira é 0, e as ancoradas não entram
 * na conta. Única tradução de "casa" para "posição"; nunca cai na casa fixa.
 */
function placeInBand(
  band: { first: number; step: number },
  reserved: readonly number[],
  place: number
): number {
  const taken = new Set(reserved)
  let position = band.first
  let free = 0

  while (true) {
    if (!taken.has(position)) {
      if (free === place) {
        return position
      }

      free += 1
    }

    position += band.step
  }
}

/**
 * A faixa da numeração de uma superfície, com as casas ancoradas. O painel
 * precisa dos numerais da ordem pendente sem importar `positionFor` do backend.
 */
export function orderFaixa(surface: string = DEFAULT_SURFACE): OrderFaixa {
  return { ...bandFor(surface), reserved: reservedPositions(surface) }
}

/**
 * A casa da próxima seção ordenável: a primeira livre **depois da última**, não
 * "no primeiro buraco" — o buraco no meio é do lojista, e a criação promete o
 * **fim** da vitrine (com o rodapé na 10, a sexta seção nasce em 11). O piso é
 * o começo da faixa, não o maior número: sem ele a seção nova cairia no bloco
 * ancorado, a colisão que a faixa existe para evitar.
 */
export function nextPosition(
  sections: readonly { position: number }[],
  surface: string = DEFAULT_SURFACE
): number {
  const band = bandFor(surface)
  const taken = new Set([
    ...reservedPositions(surface),
    ...sections.map((section) => section.position),
  ])
  const last = sections.length
    ? Math.max(...sections.map((section) => section.position))
    : band.first - band.step
  let position = Math.max(band.first, last + band.step)

  while (taken.has(position)) {
    position += band.step
  }

  return position
}

/**
 * A casa de uma seção que entra **logo depois** de outra (o padrão que volta
 * pelo "Restaurar padrão"). É a **casa livre seguinte** da faixa, não "a posição
 * do padrão" — copiá-la numa base já salva jogaria a seção no lugar errado, sem
 * nada apontando o motivo. O próximo "Salvar ordem" a acomoda na ordem da tela.
 */
export function positionAfter(
  sections: readonly { position: number }[],
  anchor: number,
  surface: string = DEFAULT_SURFACE
): number {
  const band = bandFor(surface)
  const taken = new Set([
    ...reservedPositions(surface),
    ...sections.map((section) => section.position),
  ])
  let position = anchor + band.step

  while (taken.has(position)) {
    position += band.step
  }

  return position
}

/**
 * A casa que a seção em `index` recebe ao salvar: a `index`-ésima casa livre da
 * faixa, pulando as ancoradas. É também o numeral que a lista mostra com ordem
 * pendente — um numeral que discorda da ordem visível é pior que nenhum.
 */
export function positionFor(
  index: number,
  surface: string = DEFAULT_SURFACE
): number {
  return placeInBand(bandFor(surface), reservedPositions(surface), index)
}

/**
 * Onde começa a faixa de uma **lista referenciada** (curadoria e chips): começar
 * na folga (10) faz a tabela de link mostrar 10, 20, 30, a numeração do seed.
 */
export const FIRST_LIST_POSITION = POSITION_STEP

/**
 * A posição do item na casa `index` de uma lista referenciada: a lista **é** a
 * ordem, e duas posições iguais são ordem indefinida que o lojista não conserta.
 */
export function listPositionFor(index: number): number {
  return FIRST_LIST_POSITION + index * POSITION_STEP
}

/**
 * A numeração das seções ordenáveis, na ordem em que estão na tela. Devolve
 * **só o que muda de posição** (a tela já tem as seções), e é a ordem do array
 * — e não a troca de dois valores — que impede buraco e repetição. As casas
 * ancoradas ficam de fora (`positionFor` as pula).
 */
export function renumber(
  sections: readonly { id: string; position: number }[],
  surface: string = DEFAULT_SURFACE
): { id: string; position: number }[] {
  return sections
    .map((section, index) => ({
      id: section.id,
      position: positionFor(index, surface),
    }))
    .filter((planned, index) => planned.position !== sections[index].position)
}

/**
 * Os ids da ordem que vieram no corpo (`{ ids: [...] }`). Id repetido seria duas
 * posições para a mesma seção; sem a lista não há o que ordenar (400).
 */
export function readOrderIds(value: unknown): { ids?: string[]; error?: string } {
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return { error: 'Campo "ids" deve ser uma lista de ids de seção.' }
  }

  const ids = value as string[]

  if (new Set(ids).size !== ids.length) {
    return {
      error:
        'Campo "ids" tem id repetido: a ordem é uma lista, e cada seção ' +
        "aparece uma vez.",
    }
  }

  return { ids }
}

/**
 * O que impede esta ordem de ser gravada: o que **discorda** entre a lista
 * enviada e a vitrine do banco. As três conferências são em estágios, não
 * acumuladas — uma lista com id inexistente já é outro problema. Confere:
 * existe · não é fixa · lista inteira.
 */
export function orderErrors(
  ids: readonly string[],
  sections: readonly { id: string; fixed: boolean }[]
): string[] {
  const known = new Map(sections.map((section) => [section.id, section]))
  const unknown = ids.filter((id) => !known.has(id))

  if (unknown.length) {
    return [
      `Os ids apontam seção que não existe (ou foi removida): ` +
        `${unknown.join(", ")}.`,
    ]
  }

  const fixed = ids.filter((id) => known.get(id)?.fixed)

  if (fixed.length) {
    return [
      `A ordem traz seção fixa (o cromo do site e a abertura da home), que ` +
        `mora numa casa ancorada e não é numerada: ${fixed.join(", ")}.`,
    ]
  }

  const absent = sections
    .filter((section) => !section.fixed)
    .map((section) => section.id)
    .filter((id) => !ids.includes(id))

  if (absent.length) {
    return [
      `A lista não traz a vitrine inteira: falta ${absent.join(", ")}. ` +
        `A renumeração escreve só o que veio, e o que ficou de fora ` +
        `manteria a posição antiga — que a lista nova pode estar ocupando.`,
    ]
  }

  return []
}

/**
 * Publica a ordem: renumera pelas casas livres da faixa e grava o que mudou. É
 * a **única** porta que grava ordem — antes o CRM mandava um `PATCH` por seção,
 * N gravações, e uma falha no meio deixava a vitrine com ordem que ninguém
 * pediu. Aqui a lista chega inteira e a gravação é **uma chamada**: as posições
 * mudam juntas, ou não mudam. Salvar a mesma ordem duas vezes não escreve nada.
 */
export async function applyOrder(
  service: ContentModuleService,
  { surface = DEFAULT_SURFACE, ids }: { surface?: string; ids: readonly string[] }
): Promise<{ updated: { id: string; position: number }[]; error?: string }> {
  const sections = await service.listSections({ surface, onlyEnabled: false })
  const errors = orderErrors(ids, sections)

  if (errors.length) {
    return { updated: [], error: errors.join(" ") }
  }

  // A posição atual vai junto só para o `renumber` dizer o que **muda**; a ordem
  // que decide é a do array. O `flatMap` torna impossível uma posição `undefined`.
  const ordered = ids.flatMap((id) => {
    const section = sections.find((candidate) => candidate.id === id)

    return section ? [{ id: section.id, position: section.position }] : []
  })
  const updated = renumber(ordered, surface)

  if (updated.length) {
    await service.updateContentSections(updated)
  }

  return { updated }
}
