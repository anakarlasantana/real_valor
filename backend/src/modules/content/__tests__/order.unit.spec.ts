/**
 * A numeração das seções: as **casas** da vitrine — o bloco ancorado parado e as
 * ordenáveis nas casas livres — e o que impede `position` repetida (ordem
 * indefinida na loja).
 *
 * Quem **não** tem ordem não se decide aqui: a resposta é a coluna `fixed` da
 * seção (`models/content-section.ts`), gravada na criação. Que o bloco ancorado
 * nasça fixo é cobrado em `restore.unit.spec.ts`, contra o contrato
 * (`SINGLETON_SECTION_TYPES`) — este arquivo cobre a numeração.
 *
 * As casas da home vêm do contrato (`FIXED_SECTION_POSITIONS`): 1 barra de
 * anúncio, 2 cabeçalho, 3 capa, 4 benefícios, 10 rodapé. As ordenáveis ficam nas
 * casas livres do meio — 5 a 9 com a vitrine de hoje — e a faixa completa (com
 * as ancoradas) é o que o CRM recebe no payload.
 *
 * O segundo bloco é a porta por onde a ordem é publicada (R6.5): `readOrderIds`
 * (a forma do corpo), `orderErrors` (o que a lista do CRM tem de bater com o
 * banco) e `applyOrder` (a gravação — uma chamada, só o que muda). O que se
 * prova aqui é justamente o que saiu do navegador: a lista inteira chega de uma
 * vez e as posições mudam juntas, ou não mudam.
 */
import type ContentModuleService from "../service"
import {
  applyOrder,
  bandFor,
  nextPosition,
  orderErrors,
  orderFaixa,
  positionAfter,
  positionFor,
  readOrderIds,
  renumber,
  reservedPositions,
} from "../order"

/** A primeira casa **livre** da home: logo depois do bloco ancorado do topo. */
const FIRST = 5

/** As casas ancoradas da home, na ordem — o rodapé fecha a numeração em 10. */
const RESERVED = [1, 2, 3, 4, 10]

describe("bandFor", () => {
  it("a home começa na primeira casa livre depois do bloco ancorado do topo", () => {
    expect(bandFor("home")).toEqual({ first: FIRST, step: 1 })
  })

  it("o tema não tem bloco ancorado e numera de 10 em 10, como as estações", () => {
    // As estações do `theme.json` são 10, 20, 30, 40 (`THEME_SECTIONS`): uma
    // gravação de ordem no tema tem de devolver a mesma numeração, e não a casa
    // da vitrine.
    expect(bandFor("theme")).toEqual({ first: 10, step: 10 })
  })

  it("superfície desconhecida responde como a primeira (a vitrine)", () => {
    expect(bandFor("nao-existe")).toEqual(bandFor("home"))
  })
})

describe("reservedPositions", () => {
  it("são as casas dos tipos fixos que a superfície tem — as da home", () => {
    expect(reservedPositions("home")).toEqual(RESERVED)
  })

  it("o tema não cria seção do bloco ancorado, então não tem casa reservada", () => {
    expect(reservedPositions("theme")).toEqual([])
  })
})

describe("orderFaixa", () => {
  it("é a faixa da superfície mais as casas ancoradas — o que o CRM recebe", () => {
    expect(orderFaixa("home")).toEqual({
      first: FIRST,
      step: 1,
      reserved: RESERVED,
    })
    expect(orderFaixa("theme")).toEqual({ first: 10, step: 10, reserved: [] })
  })
})

describe("positionFor", () => {
  it("numera as ordenáveis nas casas livres do meio: 5, 6, 7, 8, 9", () => {
    expect([0, 1, 2, 3, 4].map((place) => positionFor(place))).toEqual([
      5, 6, 7, 8, 9,
    ])
  })

  it("pula a casa do rodapé: a sexta seção ordenável nasce em 11", () => {
    // A casa 10 é do rodapé, e a renumeração não escreve nela — a numeração da
    // home é 1 a 10 justamente porque as ordenáveis não passam por cima do
    // bloco ancorado.
    expect(positionFor(5)).toBe(11)
    expect(positionFor(6)).toBe(12)
  })

  it("sem casa ancorada, a faixa do tema é a dela (10, 20, 30…)", () => {
    expect(positionFor(0, "theme")).toBe(10)
    expect(positionFor(2, "theme")).toBe(30)
  })
})

describe("nextPosition", () => {
  it("começa na primeira casa livre numa base vazia", () => {
    expect(nextPosition([])).toBe(FIRST)
  })

  it("não nasce dentro do bloco ancorado numa base semeada antes das casas", () => {
    // A base antiga tem a vitrine em 20, 70, 80 e o cromo em 1, 2, 10: a seção
    // nova entra depois da última (81), nunca na casa de uma fixa.
    expect(nextPosition([{ position: 20 }, { position: 70 }, { position: 80 }])).toBe(
      81
    )
    // E uma base com a vitrine abaixo da faixa (2) sobe para a primeira livre.
    expect(nextPosition([{ position: 2 }])).toBe(FIRST)
  })

  it("vai depois da última quando a vitrine já está na faixa", () => {
    expect(nextPosition([{ position: 5 }, { position: 6 }])).toBe(7)
  })

  it("pula a casa do rodapé: a sexta seção nasce em 11", () => {
    const cheia = [5, 6, 7, 8, 9].map((position) => ({ position }))

    // A casa seguinte seria 10 — do rodapé. A seção nova nasce depois dela.
    expect(nextPosition(cheia)).toBe(11)
  })

  it("no tema, a próxima casa é a próxima dezena", () => {
    expect(
      nextPosition(
        [{ position: 10 }, { position: 20 }, { position: 30 }],
        "theme"
      )
    ).toBe(40)
  })
})

describe("positionAfter", () => {
  it("entra na primeira casa livre depois da âncora, pulando as ancoradas", () => {
    // A capa está na casa 3 e a vitrine já ocupa 5 e 6: a próxima livre depois
    // dela é 7 — a 4 é da faixa de benefícios.
    expect(
      positionAfter([{ position: 3 }, { position: 5 }, { position: 6 }], 3)
    ).toBe(7)
  })

  it("desce para a próxima livre quando o trecho seguinte está cheio", () => {
    const cheia = [5, 6, 7, 8, 9].map((position) => ({ position }))

    // Todas as casas do trecho estão ocupadas: a seção entra na próxima livre,
    // depois da casa do rodapé.
    expect(positionAfter(cheia, 5)).toBe(11)
  })

  it("numa base antiga (100, 110…), entra logo depois da âncora", () => {
    // É o caso real da seção do padrão que falta e volta pelo "Restaurar
    // padrão": a base antiga tem a vitrine de 100 em 100, e a seção nova tem de
    // entrar ENTRE o que está na âncora e a próxima — não no fim da página.
    expect(positionAfter([{ position: 100 }, { position: 110 }], 100)).toBe(101)
  })

  it("no tema, a casa seguinte é a próxima dezena livre", () => {
    expect(
      positionAfter(
        [{ position: 10 }, { position: 20 }, { position: 30 }],
        10,
        "theme"
      )
    ).toBe(40)
  })
})

describe("renumber", () => {
  it("numera as ordenáveis na ordem em que elas estão na tela", () => {
    const naTela = [
      { id: "editorial", position: 8 },
      { id: "featured", position: 7 },
    ]

    expect(renumber(naTela)).toEqual([
      { id: "editorial", position: 5 },
      { id: "featured", position: 6 },
    ])
  })

  it("grava só o que muda de posição", () => {
    const naTela = [
      { id: "featured", position: 5 },
      { id: "editorial", position: 9 },
    ]

    expect(renumber(naTela)).toEqual([{ id: "editorial", position: 6 }])
  })

  it("é idempotente: uma lista já normalizada não gera gravação", () => {
    const naTela = [
      { id: "featured", position: 5 },
      { id: "editorial", position: 6 },
    ]

    expect(renumber(naTela)).toEqual([])
  })

  it("nunca repete posição, nem escreve numa casa ancorada", () => {
    const naTela = Array.from({ length: 9 }, (_, index) => ({
      id: `secao-${index}`,
      // Todas iguais: é o pior caso, o que a renumeração existe para desfazer.
      position: FIRST,
    }))

    const positions = renumber(naTela).map((planned) => planned.position)

    expect(new Set(positions).size).toBe(positions.length)
    // As ancoradas (1, 2, 3, 4 e 10) ficam de fora, e a numeração começa na
    // primeira casa livre.
    expect(positions.filter((position) => RESERVED.includes(position))).toEqual([])
    expect(positions.every((position) => position >= FIRST)).toBe(true)
  })

  it("no tema, renumera de 10 em 10", () => {
    expect(
      renumber(
        [
          { id: "natal", position: 40 },
          { id: "default", position: 10 },
        ],
        "theme"
      )
    ).toEqual([
      { id: "natal", position: 10 },
      { id: "default", position: 20 },
    ])
  })
})

describe("readOrderIds", () => {
  it("aceita a lista de ids da vitrine", () => {
    expect(readOrderIds(["featured", "collections"])).toEqual({
      ids: ["featured", "collections"],
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
    expect(
      readOrderIds(["featured", "collections", "featured"]).error
    ).toMatch(/repetido/)
  })
})


describe("orderErrors", () => {
  /** A superfície como o CRM a lê: as ordenáveis, e o bloco ancorado em volta. */
  const sections = [
    { id: "announcement", fixed: true },
    { id: "hero", fixed: true },
    { id: "featured", fixed: false },
    { id: "collections", fixed: false },
    { id: "footer", fixed: true },
  ]

  it("a ordem que a lista traz é a resposta — e o bloco fixo não entra", () => {
    // Invertida em relação ao banco de propósito: a lista é a ordem nova, e
    // reordenar não é erro nenhum. As fixas não aparecem porque não são
    // numeradas (`fixed`), e não porque a função as conheça pelo nome.
    expect(orderErrors(["collections", "featured"], sections)).toEqual([])
  })

  it("recusa id que não existe na superfície", () => {
    const [error] = orderErrors(["featured", "relampago"], sections)

    expect(error).toMatch(/não existe/)
    expect(error).toMatch(/relampago/)
  })

  it("recusa seção fixa, e fala dela antes da completude", () => {
    // `hero` está na lista e `collections` não: os dois são problema, mas o que
    // a mensagem aponta é a seção ancorada — numerá-la escreveria na casa do
    // bloco fixo. Cobrar a completude junto seria ruído: a lista está errada.
    const [error] = orderErrors(["featured", "hero"], sections)

    expect(error).toMatch(/fixa/)
    expect(error).toMatch(/hero/)
    expect(error).not.toMatch(/collections/)
  })

  it("recusa a lista que não traz a vitrine inteira", () => {
    // Renumerar quem veio deixaria `collections` com a posição antiga — que a
    // lista nova pode estar ocupando. Buraco e repetição no mesmo movimento.
    const [error] = orderErrors(["featured"], sections)

    expect(error).toMatch(/vitrine inteira/)
    expect(error).toMatch(/collections/)
  })
})

describe("applyOrder", () => {
  const sections = [
    { id: "featured", position: 5, fixed: false },
    { id: "collections", position: 6, fixed: false },
    { id: "nav", position: 2, fixed: true },
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

    const { updated } = await applyOrder(service, {
      ids: ["collections", "featured"],
    })

    expect(updated).toEqual([
      { id: "collections", position: 5 },
      { id: "featured", position: 6 },
    ])
    // Uma gravação, com as duas posições juntas: era isto que o navegador
    // fazia como um `PATCH` por seção — N transações, ordem pela metade quando
    // uma falhava no meio, e nada dizendo o que ficou gravado.
    expect(updateContentSections).toHaveBeenCalledTimes(1)
    expect(updateContentSections).toHaveBeenCalledWith(updated)
  })

  it("numa ordem já normalizada não grava nada", async () => {
    const { service, updateContentSections } = fakeService()

    const { updated } = await applyOrder(service, {
      ids: ["featured", "collections"],
    })

    expect(updated).toEqual([])
    expect(updateContentSections).not.toHaveBeenCalled()
  })

  it("não grava nada quando a lista não serve, e diz por quê", async () => {
    const { service, updateContentSections } = fakeService()

    const { updated, error } = await applyOrder(service, { ids: ["featured"] })

    expect(updated).toEqual([])
    expect(error).toMatch(/collections/)
    expect(updateContentSections).not.toHaveBeenCalled()
  })

  it("no tema, renumera de 10 em 10", async () => {
    const { service } = fakeService([
      { id: "natal", position: 10, fixed: false },
      { id: "default", position: 20, fixed: false },
    ])

    const { updated } = await applyOrder(service, {
      surface: "theme",
      ids: ["default", "natal"],
    })

    expect(updated).toEqual([
      { id: "default", position: 10 },
      { id: "natal", position: 20 },
    ])
  })
})

