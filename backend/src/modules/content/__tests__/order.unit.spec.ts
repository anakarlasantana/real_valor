/**
 * A numeração da vitrine: o que impede `position` repetida (ordem indefinida na
 * loja) e o que mantém o cromo fora da faixa numerada da vitrine.
 *
 * O teste do cromo sai do **contrato** (`SINGLETON_SECTION_TYPES`), e não de uma
 * lista copiada aqui: se um tipo deixar de ser único, este arquivo passa a
 * cobrar a consequência em vez de concordar com a cópia.
 */
import { SINGLETON_SECTION_TYPES } from "../contract"
import {
  FIRST_VITRINE_POSITION,
  POSITION_STEP,
  isChromeType,
  nextPosition,
  positionFor,
  renumber,
} from "../order"

describe("isChromeType", () => {
  it("reconhece o cromo do site pelo contrato", () => {
    for (const type of SINGLETON_SECTION_TYPES) {
      expect(isChromeType(SINGLETON_SECTION_TYPES, type)).toBe(true)
    }
  })

  it("não confunde uma seção da vitrine com cromo", () => {
    for (const type of ["hero", "benefits", "collections", "featured"]) {
      expect(isChromeType(SINGLETON_SECTION_TYPES, type)).toBe(false)
    }
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
