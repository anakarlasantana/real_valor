/**
 * A numeração da vitrine: o que impede `position` repetida (ordem indefinida na
 * loja) e o que mantém as seções fixas — o cromo do site — fora da faixa
 * numerada da vitrine.
 *
 * Quem **não** tem ordem não se decide aqui: a resposta é a coluna `fixed` da
 * seção (`models/content-section.ts`), gravada na criação. Que o cromo nasça
 * fixo é cobrado em `restore.unit.spec.ts`, contra o contrato
 * (`SINGLETON_SECTION_TYPES`) — este arquivo cobre a numeração.
 *
 * O segundo bloco é a porta por onde a ordem é publicada (R6.5): `readOrderIds`
 * (a forma do corpo), `orderErrors` (o que a lista do CRM tem de bater com o
 * banco) e `applyOrder` (a gravação — uma chamada, só o que muda). O que se
 * prova aqui é justamente o que saiu do navegador: a lista inteira chega de uma
 * vez e as posições mudam juntas, ou não mudam.
 */
import type ContentModuleService from "../service"
import {
  FIRST_VITRINE_POSITION,
  POSITION_STEP,
  applyOrder,
  nextPosition,
  orderErrors,
  positionAfter,
  positionFor,
  readOrderIds,
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

describe("readOrderIds", () => {
  it("aceita a lista de ids da vitrine", () => {
    expect(readOrderIds(["featured", "hero"])).toEqual({
      ids: ["featured", "hero"],
    })
  })

  it("recusa o que não é lista de ids de seção", () => {
    // `undefined` inclusive: nas outras listas do CRM ele é "não mexe", aqui
    // não há o que ordenar sem a lista.
    for (const value of [undefined, null, "hero", 42, ["hero", ""], ["hero", 7]]) {
      expect(readOrderIds(value).error).toMatch(/"ids"/)
    }
  })

  it("recusa id repetido", () => {
    // A ordem é uma sequência: o mesmo id duas vezes seriam duas posições para
    // a mesma seção, e nenhuma delas é a ordem que o lojista montou na tela.
    expect(readOrderIds(["hero", "featured", "hero"]).error).toMatch(/repetido/)
  })
})

describe("orderErrors", () => {
  /** A superfície como o CRM a lê: a vitrine com ordem, e o cromo em volta. */
  const sections = [
    { id: "nav", fixed: true },
    { id: "hero", fixed: false },
    { id: "featured", fixed: false },
    { id: "footer", fixed: true },
  ]

  it("a ordem que a lista traz é a resposta — e o cromo não entra", () => {
    // Invertida em relação ao banco de propósito: a lista é a ordem nova, e
    // reordenar não é erro nenhum. O cromo não aparece porque ele não é
    // numerado (`fixed`), e não porque a função o conheça pelo nome.
    expect(orderErrors(["featured", "hero"], sections)).toEqual([])
  })

  it("recusa id que não existe na superfície", () => {
    const [error] = orderErrors(["hero", "relampago"], sections)

    expect(error).toMatch(/não existe/)
    expect(error).toMatch(/relampago/)
  })

  it("recusa seção fixa, e fala dela antes da completude", () => {
    // `nav` está na lista e `featured` não: os dois são problema, mas o que a
    // mensagem aponta é o cromo — numerá-lo jogaria a barra de anúncio na faixa
    // da vitrine. Cobrar a completude junto seria ruído: a lista está errada.
    const [error] = orderErrors(["hero", "nav"], sections)

    expect(error).toMatch(/fixa/)
    expect(error).toMatch(/nav/)
    expect(error).not.toMatch(/featured/)
  })

  it("recusa a lista que não traz a vitrine inteira", () => {
    // Renumerar quem veio deixaria `featured` com a posição antiga — que a
    // lista nova pode estar ocupando. Buraco e repetição no mesmo movimento.
    const [error] = orderErrors(["hero"], sections)

    expect(error).toMatch(/vitrine inteira/)
    expect(error).toMatch(/featured/)
  })
})

describe("applyOrder", () => {
  const sections = [
    { id: "hero", position: FIRST_VITRINE_POSITION, fixed: false },
    { id: "featured", position: FIRST_VITRINE_POSITION + POSITION_STEP, fixed: false },
    { id: "nav", position: 10, fixed: true },
  ]

  /**
   * O serviço de mentira: só o I/O que a função usa (`listSections` para ler a
   * vitrine, `updateContentSections` para gravar). Quem decide a numeração é a
   * regra, conferida acima sem serviço nenhum.
   */
  const fakeService = (rows = sections) => {
    const updateContentSections = jest.fn(async (data: unknown) => data)

    return {
      updateContentSections,
      service: {
        listSections: jest.fn(async () => rows),
        updateContentSections,
      } as unknown as ContentModuleService,
    }
  }

  it("grava a ordem nova numa chamada só, e só o que muda de posição", async () => {
    const { service, updateContentSections } = fakeService()

    const { updated } = await applyOrder(service, { ids: ["featured", "hero"] })

    expect(updated).toEqual([
      { id: "featured", position: FIRST_VITRINE_POSITION },
      { id: "hero", position: FIRST_VITRINE_POSITION + POSITION_STEP },
    ])
    // Uma gravação, com as duas posições juntas: era isto que o navegador
    // fazia como um `PATCH` por seção — N transações, ordem pela metade quando
    // uma falhava no meio, e nada dizendo o que ficou gravado.
    expect(updateContentSections).toHaveBeenCalledTimes(1)
    expect(updateContentSections).toHaveBeenCalledWith(updated)
  })

  it("numa ordem já normalizada não grava nada", async () => {
    const { service, updateContentSections } = fakeService()

    const { updated } = await applyOrder(service, { ids: ["hero", "featured"] })

    expect(updated).toEqual([])
    expect(updateContentSections).not.toHaveBeenCalled()
  })

  it("não grava nada quando a lista não serve, e diz por quê", async () => {
    const { service, updateContentSections } = fakeService()

    const { updated, error } = await applyOrder(service, { ids: ["hero"] })

    expect(updated).toEqual([])
    expect(error).toMatch(/featured/)
    expect(updateContentSections).not.toHaveBeenCalled()
  })
})

