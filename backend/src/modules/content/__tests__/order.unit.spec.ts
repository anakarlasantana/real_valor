/**
 * A numeração da vitrine: o que impede `position` repetida (ordem indefinida na
 * loja) e o que mantém as seções fixas — o cromo do site — fora da faixa
 * numerada da vitrine.
 *
 * Quem **não** tem ordem não se decide aqui: a resposta é a coluna `fixed` da
 * seção (`models/content-section.ts`), gravada na criação. Que o cromo nasça
 * fixo é cobrado em `restore.unit.spec.ts`, contra o contrato
 * (`SINGLETON_SECTION_TYPES`) — este arquivo cobre a numeração.
 */
import {
  FIRST_VITRINE_POSITION,
  POSITION_STEP,
  nextPosition,
  positionAfter,
  positionFor,
  renumber,
} from "../order"

describe("positionAfter", () => {
  it("numa vitrine renumerada (100, 110…), entra na metade do vão", () => {
    // É o caso real: hero em 100, a coleção em 110, e a seção nova (o trilho,
    // que no padrão vem logo depois do hero) precisa entrar entre as duas.
    expect(positionAfter([{ position: 100 }, { position: 110 }], 100)).toBe(105)
  })

  it("sem ninguém depois do vizinho, usa a folga padrão", () => {
    expect(positionAfter([{ position: 100 }], 100)).toBe(100 + POSITION_STEP)
  })

  it("ignora as posições anteriores ao vizinho", () => {
    // O cromo (10, 20) e o rodapé (90) estão na lista, mas quem manda é o que
    // vem DEPOIS da âncora.
    expect(
      positionAfter(
        [{ position: 10 }, { position: 20 }, { position: 90 }, { position: 100 }],
        90
      )
    ).toBe(95)
  })

  it("vão de um inteiro só não tem meio: entra depois, e a renumeração conserta", () => {
    // Posições adjacentes só existem em base mexida à mão (a faixa do CRM é de
    // 10 em 10). Não há inteiro entre 100 e 101, então a seção entra depois — e
    // a próxima gravação de ordem renumera a vitrine inteira.
    expect(positionAfter([{ position: 100 }, { position: 101 }], 100)).toBe(
      101 + POSITION_STEP
    )
  })
})

describe("nextPosition", () => {
  it("começa na faixa da vitrine numa base vazia", () => {
    expect(nextPosition([])).toBe(FIRST_VITRINE_POSITION)
  })

  it("não nasce dentro da faixa do cromo numa base semeada antes da faixa", () => {
    // O seed histórico numera a vitrine em 20, 30, 40…, e o cromo até 80: a
    // seção nova tem de cair depois da faixa reservada, não no meio dela.
    const historicas = [{ position: 20 }, { position: 70 }, { position: 80 }]

    expect(nextPosition(historicas)).toBe(FIRST_VITRINE_POSITION)
  })

  it("vai depois da última quando a vitrine já está normalizada", () => {
    const normalizadas = [
      { position: FIRST_VITRINE_POSITION },
      { position: FIRST_VITRINE_POSITION + POSITION_STEP },
    ]

    expect(nextPosition(normalizadas)).toBe(
      FIRST_VITRINE_POSITION + 2 * POSITION_STEP
    )
  })
})

describe("positionFor", () => {
  it("numera a partir da faixa da vitrine", () => {
    expect(positionFor(0)).toBe(FIRST_VITRINE_POSITION)
    expect(positionFor(1)).toBe(FIRST_VITRINE_POSITION + POSITION_STEP)
    expect(positionFor(3)).toBe(FIRST_VITRINE_POSITION + 3 * POSITION_STEP)
  })
})

describe("renumber", () => {
  it("numera a vitrine inteira na ordem em que ela está na tela", () => {
    const naTela = [
      { id: "editorial", position: 70 },
      { id: "hero", position: 20 },
      { id: "benefits", position: 30 },
    ]

    expect(renumber(naTela)).toEqual([
      { id: "editorial", position: FIRST_VITRINE_POSITION },
      { id: "hero", position: FIRST_VITRINE_POSITION + POSITION_STEP },
      { id: "benefits", position: FIRST_VITRINE_POSITION + 2 * POSITION_STEP },
    ])
  })

  it("grava só o que muda de posição", () => {
    const naTela = [
      { id: "hero", position: FIRST_VITRINE_POSITION },
      { id: "benefits", position: 40 },
    ]

    expect(renumber(naTela)).toEqual([
      { id: "benefits", position: FIRST_VITRINE_POSITION + POSITION_STEP },
    ])
  })

  it("é idempotente: uma lista já normalizada não gera gravação", () => {
    const naTela = [
      { id: "hero", position: FIRST_VITRINE_POSITION },
      { id: "benefits", position: FIRST_VITRINE_POSITION + POSITION_STEP },
    ]

    expect(renumber(naTela)).toEqual([])
  })

  it("nunca repete posição, e mantém todas dentro da faixa da vitrine", () => {
    const naTela = Array.from({ length: 9 }, (_, index) => ({
      id: `secao-${index}`,
      // Todas iguais: é o pior caso, o que a renumeração existe para desfazer.
      position: FIRST_VITRINE_POSITION,
    }))

    const positions = renumber(naTela).map((planned) => planned.position)

    expect(new Set(positions).size).toBe(positions.length)
    expect(positions.every((position) => position >= FIRST_VITRINE_POSITION)).toBe(
      true
    )
  })
})
