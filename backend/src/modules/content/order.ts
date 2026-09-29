/**
 * A ordem da vitrine — a regra que o CRM usa para numerar as seções.
 * -------------------------------------------------------------------------
 * Mora aqui, e não dentro da página do admin, porque é uma decisão pura e
 * testável: quais tipos entram na ordem, de onde a numeração começa e o que
 * "próxima posição" quer dizer. A página do CRM só clica.
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
 * Onde começa a faixa da **curadoria** (os produtos de uma seção).
 *
 * Mesma folga do seed, sem a faixa reservada ao cromo: a curadoria é uma lista
 * própria — a de **uma** seção —, e a numeração dela não concorre com a da
 * vitrine. Poderia começar em qualquer número; começar na folga (10) é o que faz
 * o `\d` da tabela de link mostrar 10, 20, 30 em vez de 100, 110, 120, que é a
 * faixa que a vitrine já usa para dizer "seções".
 */
export const FIRST_CURATION_POSITION = POSITION_STEP

/**
 * A posição do produto na casa `index` da curadoria.
 *
 * A lista **é** a ordem: o CRM manda os ids na ordem da tela e a posição sai
 * daqui, em vez de ser digitada. É a mesma ideia do `positionFor` das seções, e
 * pelo mesmo motivo: duas posições iguais são ordem indefinida na vitrine, e o
 * lojista não consegue consertar isso pela tela.
 */
export function curationPositionFor(index: number): number {
  return FIRST_CURATION_POSITION + index * POSITION_STEP
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
