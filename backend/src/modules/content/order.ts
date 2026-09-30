/**
 * A ordem da vitrine — a regra que o CRM usa para numerar as seções, e a única
 * gravação que a aplica.
 * -------------------------------------------------------------------------
 * Mora aqui, e não dentro da página do admin, porque é uma decisão pura e
 * testável: quais tipos entram na ordem, de onde a numeração começa e o que
 * "próxima posição" quer dizer. A página do CRM só clica.
 *
 * As funções puras (`bandFor`, `reservedPositions`, `nextPosition`,
 * `positionAfter`, `positionFor`, `renumber`, `orderErrors`) não sabem de banco:
 * recebem listas e devolvem números. A gravação é **uma só** (`applyOrder`, no
 * fim), e é de propósito que ela more aqui: publicar a ordem é renumeração +
 * escrita + aviso, e separar as duas partes convidaria a uma segunda
 * renumeração em outro lugar — que é exatamente o que a fase R6.5 veio tirar do
 * navegador.
 *
 * ## A posição é uma casa, e cada casa tem dono
 *
 * A posição de uma seção é a **casa** dela na página, e a faixa de casas é da
 * superfície (`CONTENT_SURFACES[i].order`, no contrato). Na home:
 *
 *     1  barra de anúncio  ┐
 *     2  cabeçalho         │ ancoradas (`FIXED_SECTION_POSITIONS`): a seção
 *     3  capa (hero)       │ fixa mora sempre aqui, e nada a renumera
 *     4  benefícios        ┘
 *     5… 9  as seções ordenáveis — de 1 em 1, na ordem da tela
 *    10  rodapé            ← ancorada: fecha a numeração
 *
 * Ou seja: a home inteira cabe em **1 a 10**, e o que o lojista ordena são as
 * casas livres do meio. A renumeração **pula** as casas ancoradas
 * (`reservedPositions`), então ela nunca colide com o bloco fixo: hoje as cinco
 * ordenáveis ficam em 5 a 9, e uma sexta nasceria em 11 — a casa 10 é do
 * rodapé. O tema, que não tem bloco fixo, numera de 10 em 10, como as estações
 * do `theme.json`.
 *
 * O que a regra protege é `position` repetida. A loja ordena por essa coluna
 * (`listSections`, com `order: { position: "ASC" }`), então duas seções com o
 * mesmo número têm ordem indefinida — e o lojista não consegue consertar isso
 * digitando, porque as duas dizem o mesmo número. Vale para a seção **fixa**,
 * que nem sequer é ordenada por ela: se uma ordenável cair na casa de uma fixa,
 * a lista passa a ser sorteio a cada carregamento.
 *
 * Quem **tem** ordem é a coluna `fixed` da linha: a tela lê a coluna, e o que
 * nasce fixo (o cromo do site e a abertura da home, `SINGLETON_SECTION_TYPES`
 * no contrato) é gravado na criação, pelas duas portas que criam seção —
 * `restore.ts`, pelo botão "Restaurar padrão"/seed, e o `POST /admin/content`.
 * A regra é a do contrato e não uma lista escrita aqui, e é a mesma que a rota
 * aplica para só existir um cromo de cada tipo.
 */
import { CONTENT_SURFACES, FIXED_SECTION_POSITIONS } from "./contract"
import type ContentModuleService from "./service"


/** A superfície que responde quando ninguém diz qual: a vitrine. */
export const DEFAULT_SURFACE = "home"

/**
 * A folga das **listas referenciadas** de uma seção — a curadoria de produtos
 * (`curation.ts`) e os chips de categoria (`filters.ts`).
 *
 * Não é a folga das seções: as casas delas vêm da faixa da superfície
 * (`bandFor`), que na home é de 1 em 1. Aqui a folga continua 10 porque a
 * origem é outra — o seed numera as listas de 10 em 10 (a mesma numeração do
 * `theme.json`), e `FIRST_LIST_POSITION` sai daqui.
 */
export const POSITION_STEP = 10

/**
 * A faixa de casas de uma superfície, como o **dado** que o CRM recebe.
 *
 * `reserved` são as casas ancoradas da superfície (as do bloco fixo, ver
 * `FIXED_SECTION_POSITIONS`): a numeração das seções ordenáveis as pula. Vai
 * junto porque o painel precisa prever o mesmo numeral que o servidor vai
 * gravar — com a home em 1 a 10, a sexta seção da vitrine recebe 11, e não a
 * casa 10, que é do rodapé.
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
 * As casas ancoradas de uma superfície — as dos **tipos fixos que ela tem**.
 *
 * Sai da lista de tipos da própria superfície (`CONTENT_SURFACES[i].types`), e
 * não de um `if (surface === "home")`: a superfície de tema não cria seção
 * nenhuma do bloco fixo, então a faixa dela não tem casa ancorada, e uma
 * superfície nova no contrato responde sozinha.
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
 * A casa de número `place` da faixa — a primeira é 0, e as casas ancoradas não
 * entram na conta.
 *
 * É a única tradução de "casa" para "posição" no módulo: `positionFor` e
 * `renumber` saem daqui, e é ela que garante que a numeração das seções
 * ordenáveis nunca caia na casa de uma seção fixa.
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
 * A faixa da numeração de uma superfície, com as casas ancoradas.
 *
 * O painel precisa do numeral das seções enquanto a ordem está pendente na tela
 * (o número gravado não corresponde mais ao que se vê), e a alternativa era ele
 * importar `positionFor` do backend — código de servidor no bundle do
 * navegador. Com a faixa viajando como dado, o painel desenha o mesmo número
 * sem importar valor nenhum daqui: quem **grava** continua sendo esta regra
 * (`applyOrder`), e o que a tela mostra é a previsão dela.
 */
export function orderFaixa(surface: string = DEFAULT_SURFACE): OrderFaixa {
  return { ...bandFor(surface), reserved: reservedPositions(surface) }
}

/**
 * A casa da próxima seção ordenável: a primeira livre **depois da última**.
 *
 * Recebe **só as seções ordenáveis** (quem chama filtra `fixed`): a seção fixa
 * tem casa própria e não é numerada — contá-la faria a seção nova nascer depois
 * do rodapé, longe de onde ela aparece.
 *
 * "Depois da última", e não "no primeiro buraco": um buraco no meio é do lojista
 * (ele apagou uma seção dali), e a criação promete o **fim** da vitrine. As
 * casas ancoradas da faixa são puladas, então a sexta seção da home nasce em
 * 11 — nunca na casa 10, que é do rodapé.
 *
 * O piso é o começo da faixa, e não o maior número existente: uma base semeada
 * antes desta regra tem a vitrine em 20, 30, 40… (ou em 100, 110, 120…), e sem
 * o piso a seção nova nasceria dentro do bloco ancorado — exatamente a colisão
 * que a faixa existe para evitar. A primeira gravação de ordem normaliza o
 * resto (`renumber`).
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
 * A casa de uma seção que entra **logo depois** de outra.
 *
 * É o caso da seção do padrão que falta na base e volta pelo "Restaurar
 * padrão": o trilho de lançamentos entra depois da capa. A regra é a **casa
 * livre seguinte** da faixa — a que não é de ninguém, nem ancorada nem ocupada
 * por outra seção: com a home de 1 a 10 e a capa na casa 3, o trilho cai na 5
 * (a 4 é da faixa de benefícios), se estiver livre.
 *
 * Não é "a posição do padrão": a numeração do padrão só vale numa base que
 * ainda está nela. Copiá-la numa base que já passou pelo "Salvar ordem" faria a
 * seção nascer no lugar errado da página, sem nada apontando o motivo.
 *
 * E o que sobra do vão não interessa: a faixa numera de casa em casa, então a
 * seção entra na primeira casa livre depois da âncora. Se o trecho estiver
 * cheio, ela desce para a próxima livre — e o próximo "Salvar ordem" a acomoda
 * na ordem que o lojista montou na tela, que é quem manda na vitrine.
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
 * A casa que a seção em `index` recebe quando a ordem é salva: a `index`-ésima
 * casa livre da faixa, pulando as ancoradas.
 *
 * É também o numeral que a lista mostra quando há ordem pendente: com a lista já
 * mexida na tela, o número gravado não corresponde mais ao que se vê, e um
 * numeral que discorda da ordem visível é pior do que nenhum.
 */
export function positionFor(
  index: number,
  surface: string = DEFAULT_SURFACE
): number {
  return placeInBand(bandFor(surface), reservedPositions(surface), index)
}

/**
 * Onde começa a faixa de uma **lista referenciada** de uma seção.
 *
 * São duas hoje, e as duas são a lista de **uma** seção: a curadoria de produtos
 * (`curation.ts`) e os chips de categoria (`filters.ts`). Cada uma tem a própria
 * numeração, então elas não concorrem entre si nem com as casas das seções.
 *
 * Poderia começar em qualquer número; começar na folga (10) é o que faz o `\d`
 * da tabela de link mostrar 10, 20, 30 — a numeração do seed, a mesma das
 * estações do tema — em vez de 1, 2, 3, que na home são as casas do bloco
 * ancorado.
 */
export const FIRST_LIST_POSITION = POSITION_STEP

/**
 * A posição do item na casa `index` de uma lista referenciada.
 *
 * A lista **é** a ordem: o CRM manda os ids na ordem da tela e a posição sai
 * daqui, em vez de ser digitada. É a mesma ideia do `positionFor` das seções, e
 * pelo mesmo motivo: duas posições iguais são ordem indefinida na vitrine, e o
 * lojista não consegue consertar isso pela tela.
 *
 * Vale para as duas listas: o produto na curadoria e o chip na vitrine ocupam a
 * mesma faixa, porque a ordem de cada uma é lida na entidade do próprio link.
 */
export function listPositionFor(index: number): number {
  return FIRST_LIST_POSITION + index * POSITION_STEP
}

/**
 * A numeração das seções ordenáveis de uma superfície, na ordem em que elas
 * estão na tela.
 *
 * Devolve **só o que muda de posição**: a tela já tem as seções, e gravar as que
 * não se mexeram seria escrever no banco para deixar tudo igual. A ordem do
 * array é a ordem a gravar, e é ela — e não a troca de dois valores — que
 * impede buraco e repetição. As casas ancoradas da faixa ficam de fora
 * (`positionFor` as pula), então a renumeração nunca escreve na casa de uma
 * seção fixa.
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
 * Os ids da ordem que vieram no corpo (`{ ids: [...] }`).
 *
 * A forma é conferida aqui pelo mesmo motivo das outras listas do CRM
 * (`resolvers.ts`): o corpo é de terceiros — o painel, um `curl`, um script —,
 * e uma ordem é uma **sequência**: id repetido significaria duas posições para
 * a mesma seção, e um id vazio, uma posição para ninguém. `undefined` não é
 * "não mexe" aqui como nas referências da seção: sem a lista não há o que
 * ordenar, e a resposta é 400.
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
 * O que impede esta ordem de ser gravada — a lista vem pronta e a vitrine é a
 * do banco, então o que se responde é o que **discorda** entre as duas.
 *
 * As três conferências são em estágios, e não acumuladas: a lista com um id que
 * não existe é de outro planeta (uma aba velha do CRM, um id digitado), e nesse
 * caso cobrar também a completude seria ruído — o que falta é a lista certa.
 * Mesma coisa com a seção fixa: ela não entra na ordenação, então ela é o
 * primeiro problema a resolver.
 *
 * | Confere | Por que |
 * | --- | --- |
 * | existe | o id vem do corpo; um id inventado gravaria posição nenhuma |
 * | não é fixa | a seção fixa mora numa casa ancorada: numerá-la a jogaria na faixa das ordenáveis |
 * | lista inteira | renumera quem veio; quem ficou de fora manteria a posição antiga — e a nova lista pode colidir com ela |
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
 * Publica a ordem das seções: renumera pelas casas livres da faixa (na home, 5 a
 * 9) e grava o que mudou.
 *
 * É a **única** porta que grava ordem, e existe para o CRM não fazer isso pelo
 * navegador: antes o painel mandava um `PATCH` por seção — N requisições, N
 * gravações, N avisos à loja — e uma falha no meio deixava a vitrine com uma
 * ordem que ninguém pediu. Aqui a lista chega inteira, a renumeração sai da
 * regra pura (`renumber`) e a gravação é **uma chamada**: as posições mudam
 * juntas, ou não mudam.
 *
 * Só o que muda de posição é gravado (`renumber` devolve a diferença), então
 * salvar a mesma ordem duas vezes não escreve nada na segunda — e a rota não
 * avisa a loja à toa.
 *
 * A lista é a da superfície (`surface`, `home` por padrão) e a leitura é a
 * mesma da tela (`listSections`): o que o CRM mandou tem de bater com o que a
 * loja vê. A faixa é a **dela** (`bandFor`): a home numera de 1 em 1 e pula as
 * casas ancoradas; o tema, de 10 em 10.
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

  // A posição atual vai junto só para o `renumber` poder dizer o que **muda**;
  // a ordem que decide a numeração é a do array — a que está na tela. O
  // `flatMap` (em vez de um `map` com asserção) é o que torna impossível uma
  // posição `undefined` chegar aqui: `orderErrors` já garantiu que todo id
  // existe, e a linha que não existir simplesmente não entra.
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
