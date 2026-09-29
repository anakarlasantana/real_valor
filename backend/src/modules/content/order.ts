/**
 * A ordem da vitrine — a regra que o CRM usa para numerar as seções, e a única
 * gravação que a aplica.
 * -------------------------------------------------------------------------
 * Mora aqui, e não dentro da página do admin, porque é uma decisão pura e
 * testável: quais tipos entram na ordem, de onde a numeração começa e o que
 * "próxima posição" quer dizer. A página do CRM só clica.
 *
 * As funções puras (`nextPosition`, `positionAfter`, `positionFor`, `renumber`,
 * `orderErrors`) não sabem de banco: recebem listas e devolvem números. A
 * gravação é **uma só** (`applyOrder`, no fim), e é de propósito que ela more
 * aqui: publicar a ordem é renumeração + escrita + aviso, e separar as duas
 * partes convidaria a uma segunda renumeração em outro lugar — que é
 * exatamente o que a fase R6.5 veio tirar do navegador.
 *
 * O que a regra protege é `position` repetida. A loja ordena por essa coluna
 * (`listSections`, com `order: { position: "ASC" }`), então duas seções com o
 * mesmo número têm ordem indefinida — e o lojista não consegue consertar isso
 * digitando, porque as duas dizem o mesmo número. Vale para a seção **fixa**,
 * que tem posição própria e nem sequer é ordenado por ela: se entrar na mesma
 * faixa numerada, a lista passa a ser sorteio a cada carregamento.
 *
 * Quem **tem** ordem é a coluna `fixed` da linha: a tela lê a coluna, e o que
 * nasce fixo (o cromo do site, `SINGLETON_SECTION_TYPES` no contrato) é gravado
 * na criação, pelas duas portas que criam seção — `restore.ts`, pelo botão
 * "Restaurar padrão"/seed, e o `POST /admin/content`. A regra é a do contrato e
 * não uma lista escrita aqui, e é a mesma que a rota aplica para só existir um
 * cromo de cada tipo.
 */
import type ContentModuleService from "./service"


/**
 * Onde começa a faixa de posições da vitrine.
 *
 * Abaixo dele mora o **cromo do site** (barra de anúncio, cabeçalho e rodapé),
 * que a loja resolve por `type` — a posição dele não decide nada. Separar as
 * faixas é o que garante que a renumeração da vitrine nunca colida com ele.
 */
export const FIRST_VITRINE_POSITION = 100

/** A folga entre posições, a mesma do seed: sobra espaço para inserir no meio. */
export const POSITION_STEP = 10

/**
 * A posição da próxima seção da vitrine: depois da última, com a mesma folga do
 * seed.
 *
 * Recebe **só a vitrine** — o cromo não conta. Contá-lo faria a seção nova
 * nascer depois do rodapé, longe de onde ela aparece.
 *
 * O piso é `FIRST_VITRINE_POSITION - POSITION_STEP`, e não o maior número
 * existente: uma base semeada antes desta regra tem a vitrine em 20, 30, 40…, e
 * sem o piso a seção nova nasceria em 80 — dentro da faixa do cromo, que é
 * exatamente a colisão que a faixa existe para evitar. A primeira gravação de
 * ordem normaliza o resto (`renumber`).
 */
export function nextPosition(sections: readonly { position: number }[]): number {
  return (
    Math.max(
      FIRST_VITRINE_POSITION - POSITION_STEP,
      ...sections.map((section) => section.position)
    ) + POSITION_STEP
  )
}

/**
 * A posição de uma seção que entra **logo depois** de outra na ordem atual.
 *
 * É o caso da seção nova que o padrão coloca no meio da vitrine — o trilho de
 * lançamentos entra depois do hero. A numeração do padrão (`defaults.ts`) é a do
 * protótipo (hero 20, lançamentos 25, benefícios 30), e ela **só vale** numa
 * base que ainda está nessa numeração. Numa base que já passou pelo "Salvar
 * ordem" do CRM a vitrine foi renumerada de 100 em 100, e copiar 25 dali faria
 * a seção nascer ANTES do hero — no lugar errado da página, e sem nada
 * apontando o motivo.
 *
 * A resposta não é a posição do padrão nem a do vizinho + folga: é a **metade do
 * vão** até a próxima seção na ordem atual. Com a vitrine em 100, 110, 120…, a
 * seção que entra depois do hero (100) recebe 105 — entre o hero e a coleção,
 * que é onde ela deve aparecer — e o próximo "Salvar ordem" a normaliza para a
 * faixa de 10 em 10.
 *
 * Sem ninguém depois, a folga padrão basta. E se o vão não couber um inteiro
 * (posições adjacentes, que só o CRM cria à mão — a faixa dele é de 10 em 10),
 * a seção entra depois do vizinho: não há inteiro entre 100 e 101, e a ordem
 * volta ao lugar na próxima gravação de ordem, que renumera a vitrine inteira.
 */
export function positionAfter(
  sections: readonly { position: number }[],
  anchor: number
): number {
  const next = sections
    .map((section) => section.position)
    .filter((position) => position > anchor)
    .sort((a, b) => a - b)[0]

  if (next === undefined) {
    return anchor + POSITION_STEP
  }

  const half = Math.floor((next - anchor) / 2)

  return half >= 1 ? anchor + half : next + POSITION_STEP
}

/**
 * A posição que a seção na casa `index` recebe quando a ordem é salva.
 *
 * É também o numeral que a lista mostra quando há ordem pendente: com a lista já
 * mexida na tela, o número gravado não corresponde mais ao que se vê, e um
 * numeral que discorda da ordem visível é pior do que nenhum.
 */
export function positionFor(index: number): number {
  return FIRST_VITRINE_POSITION + index * POSITION_STEP
}

/**
 * Onde começa a faixa de uma **lista referenciada** de uma seção.
 *
 * São duas hoje, e as duas são a lista de **uma** seção: a curadoria de produtos
 * (`curation.ts`) e os chips de categoria (`filters.ts`). Cada uma tem a própria
 * numeração, então elas não concorrem entre si nem com a vitrine.
 *
 * Mesma folga do seed, sem a faixa reservada ao cromo. Poderia começar em
 * qualquer número; começar na folga (10) é o que faz o `\d` da tabela de link
 * mostrar 10, 20, 30 em vez de 100, 110, 120, que é a faixa que a vitrine já usa
 * para dizer "seções".
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
 * A numeração da vitrine inteira, na ordem em que ela está na tela.
 *
 * Devolve **só o que muda de posição**: a tela já tem as seções, e gravar as que
 * não se mexeram seria escrever no banco para deixar tudo igual. A ordem do
 * array é a ordem a gravar, e é ela — e não a troca de dois valores — que
 * impede buraco e repetição.
 */
export function renumber(
  sections: readonly { id: string; position: number }[]
): { id: string; position: number }[] {
  return sections
    .map((section, index) => ({ id: section.id, position: positionFor(index) }))
    .filter((planned, index) => planned.position !== sections[index].position)
}

/**
 * A faixa da numeração, como o **dado** que o CRM recebe no payload.
 *
 * O painel precisa do numeral das seções enquanto a ordem está pendente na tela
 * (o número gravado não corresponde mais ao que se vê), e a alternativa era ele
 * importar `positionFor` do backend — código de servidor no bundle do
 * navegador. Com a faixa viajando como dado, o painel desenha o mesmo número
 * sem importar valor nenhum daqui: quem **grava** continua sendo esta regra
 * (`applyOrder`), e o que a tela mostra é a previsão dela.
 */
export type OrderFaixa = { first: number; step: number }

/** A faixa, a partir das constantes — quem responde é a regra, não o payload. */
export function orderFaixa(): OrderFaixa {
  return { first: FIRST_VITRINE_POSITION, step: POSITION_STEP }
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
 * | não é fixa | o cromo do site é desenhado em todas as rotas: numerá-lo o jogaria na faixa da vitrine |
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
      `A ordem traz seção fixa (o cromo do site), que não é numerada: ` +
        `${fixed.join(", ")}.`,
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
 * Publica a ordem da vitrine: renumera (100, 110, 120…) e grava o que mudou.
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
 * loja vê.
 */
export async function applyOrder(
  service: ContentModuleService,
  { surface = "home", ids }: { surface?: string; ids: readonly string[] }
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
  const updated = renumber(ordered)

  if (updated.length) {
    await service.updateContentSections(updated)
  }

  return { updated }
}
