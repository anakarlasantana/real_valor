/**
 * A posição com que o "Restaurar padrão" cria cada seção que falta.
 *
 * O que este teste protege é a base que **já passou pelo CRM**: a numeração do
 * padrão é a do protótipo (`hero` 20, `lancamentos` 25), e a vitrine de uma base
 * reordenada está em 100, 110, 120…. Copiar a posição do padrão ali fazia a
 * seção nova nascer **antes do hero** — o trilho de lançamentos apareceria
 * acima da fotografia de abertura, e nada na tela apontaria o motivo.
 *
 * O caso da base vazia é o outro lado: sem nenhum vizinho, a numeração do
 * padrão é a ordem certa, e ela vale para a lista inteira.
 */
import {
  SINGLETON_SECTION_TYPES,
  THEME_SURFACE,
  THEME_TYPE,
  isSingletonSectionType,
  themeColorField,
} from "../contract"
import type { QueryGraph, RemoteLink } from "../curation"
import { DEFAULT_HOME_SECTIONS } from "../defaults"
import {
  defaultsFor,
  planRestoredPositions,
  restoreDefaultSections,
} from "../restore"
import type ContentModuleService from "../service"
import { THEME_FILES } from "../themes"

/** A ordem em que as seções aparecem, dado o plano. */
const order = (positions: { id: string; position: number }[]) =>
  [...positions].sort((a, b) => a.position - b.position).map(({ id }) => id)

describe("planRestoredPositions", () => {
  it("numa base renumerada, a seção nova entra logo depois do vizinho do padrão", () => {
    // A base como o "Salvar ordem" do CRM a deixa (é o estado do ambiente
    // local): vitrine de 100 em 100, cromo na faixa de baixo. Falta só o
    // `lancamentos`. Repare que a ordem ATUAL não é a do padrão — a coleção
    // veio antes da faixa de benefícios, porque quem arruma é o lojista.
    const existing = [
      { id: "nav", position: 10 },
      { id: "announcement", position: 20 },
      { id: "footer", position: 90 },
      { id: "hero", position: 100 },
      { id: "collections", position: 110 },
      { id: "benefits", position: 120 },
      { id: "featured", position: 130 },
      { id: "editorial", position: 140 },
      { id: "instagram", position: 150 },
    ]

    const plan = planRestoredPositions(existing)

    expect(plan).toEqual([{ id: "lancamentos", position: 105 }])
    // E, na prática: o trilho entre o hero (100) e as coleções (110) — e não
    // antes do hero, que é onde a posição 25 do padrão cairia.
    expect(order([...existing, ...plan])).toEqual([
      "nav",
      "announcement",
      "footer",
      "hero",
      "lancamentos",
      "collections",
      "benefits",
      "featured",
      "editorial",
      "instagram",
    ])
  })

  it("numa base vazia, a ordem é a do padrão (a numeração do protótipo vale)", () => {
    const plan = planRestoredPositions([])

    expect(plan.map(({ id }) => id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(({ id }) => id)
    )
    expect(order(plan)).toEqual(DEFAULT_HOME_SECTIONS.map(({ id }) => id))
    // A primeira é a do padrão (a barra de anúncio não tem vizinho anterior),
    // e nenhuma posição se repete — ordem indefinida é o que a numeração evita.
    expect(plan[0].position).toBe(DEFAULT_HOME_SECTIONS[0].position)
    expect(new Set(plan.map(({ position }) => position)).size).toBe(plan.length)
  })

  it("não mexe em nada quando todas as seções já existem", () => {
    expect(planRestoredPositions(DEFAULT_HOME_SECTIONS)).toEqual([])
  })

  it("a seção que vem antes de um vizinho ausente entra depois do que existe", () => {
    // Base com o cromo e mais nada: o hero (vizinho do padrão é a barra de
    // anúncio) entra depois dela, não na posição 20 do protótipo — que é igual
    // à da barra e daria ordem indefinida.
    const existing = [
      { id: "nav", position: 10 },
      { id: "announcement", position: 20 },
      { id: "footer", position: 90 },
    ]

    const plan = planRestoredPositions(existing)
    const positions = plan.map(({ position }) => position)

    expect(order([...existing, ...plan])).toEqual([
      "nav",
      "announcement",
      "hero",
      "lancamentos",
      "benefits",
      "collections",
      "featured",
      "editorial",
      "instagram",
      "footer",
    ])
    expect(new Set(positions).size).toBe(positions.length)
  })
})

/**
 * A coluna `fixed` de quem **nasce**.
 *
 * O CRM não adivinha o cromo pelo tipo na hora de desenhar: ele lê a coluna da
 * seção (`models/content-section.ts`). Se quem cria não gravasse a resposta, a
 * barra de anúncio nasceria "móvel" — numeral, setas e um movimento que a loja
 * não faz, porque o layout resolve o cromo por `type`.
 *
 * A lista de tipos únicos sai do **contrato** (`SINGLETON_SECTION_TYPES`), e não
 * de uma cópia aqui: se um tipo deixar de ser único, este teste passa a cobrar a
 * consequência em vez de concordar com a cópia.
 */
describe("restoreDefaultSections", () => {
  type CreatedRow = {
    id: string
    surface: string
    type: string
    enabled: boolean
    position: number
    fixed: boolean
    data: Record<string, unknown>
  }

  /**
   * O serviço de mentira: só o I/O que a função usa (`listSections` para saber o
   * que falta, `createContentSections` para gravar). A regra de onde cada seção
   * entra é conferida acima, sem serviço nenhum.
   */
  const fakeService = (existing: readonly { id: string; position: number }[] = []) => {
    const createContentSections = jest.fn(async (rows: readonly unknown[]) => rows)
    const listSections = jest.fn(async () =>
      existing.map((row) => ({ ...row, enabled: true, fixed: false, type: "" }))
    )

    return {
      createContentSections,
      service: {
        createContentSections,
        listSections,
      } as unknown as ContentModuleService,
    }
  }

  /** As linhas que a função mandou criar. */
  const createdRows = (create: jest.Mock): CreatedRow[] =>
    (create.mock.calls[0]?.[0] ?? []) as CreatedRow[]

  it("a seção do cromo nasce fixa; a da vitrine, não", async () => {
    const { createContentSections, service } = fakeService()

    const result = await restoreDefaultSections(service)
    const rows = createdRows(createContentSections)

    expect(result.created).toEqual(DEFAULT_HOME_SECTIONS.map(({ id }) => id))
    expect(rows.map((row) => row.fixed)).toEqual(
      DEFAULT_HOME_SECTIONS.map(({ type }) => isSingletonSectionType(type))
    )
    // E o cromo gravado é exatamente a lista do contrato — nem a mais, nem a
    // menos: uma seção dele sem `fixed` voltaria a receber setas na tela.
    expect(rows.filter((row) => row.fixed).map((row) => row.type).sort()).toEqual(
      [...SINGLETON_SECTION_TYPES].sort()
    )
  })

  it("o cromo que já existe não é recriado", async () => {
    // Numa base em que só falta a vitrine, nada do que nasce é fixo: o cromo já
    // está lá (e continua sendo o que a coluna dele diz).
    const existing = [
      { id: "nav", position: 10 },
      { id: "announcement", position: 20 },
      { id: "footer", position: 90 },
    ]
    const { createContentSections, service } = fakeService(existing)

    const result = await restoreDefaultSections(service)

    expect(result.kept).toBe(existing.length)
    expect(createdRows(createContentSections).some((row) => row.fixed)).toBe(false)
  })

  it("não grava nada quando todas as seções já existem", async () => {
    const { createContentSections, service } = fakeService(
      DEFAULT_HOME_SECTIONS.map(({ id, position }) => ({ id, position }))
    )

    const result = await restoreDefaultSections(service)

    expect(result).toEqual({
      created: [],
      kept: DEFAULT_HOME_SECTIONS.length,
      chips: [],
    })
    expect(createContentSections).not.toHaveBeenCalled()
  })

  /**
   * Os chips da seção que nasce.
   *
   * É a parte da seção que não viaja no `data` — os chips são referência (o link
   * `content_section_category`) —, e por isso o "Restaurar padrão" precisa de um
   * segundo passo, com o id da seção recém-criada. Sem ele, a vitrine nasceria
   * sem chip nenhum: o catálogo inteiro no lugar do que o padrão promete.
   */
  it("a seção que nasce leva os chips padrão", async () => {
    const { service } = fakeService()
    const calls: string[] = []
    const link = {
      create: async (links: readonly unknown[]) => {
        calls.push(`create:${links.length}`)
        return links
      },
      dismiss: async () => [],
      delete: async () => [],
    } as unknown as RemoteLink
    const query = {
      graph: (async ({ entity }: { entity: string }) => ({
        data:
          entity === "product_category"
            ? [{ id: "pcat_v", name: "Vestidos", handle: "vestidos" }]
            : [],
      })) as unknown as QueryGraph["graph"],
    } as QueryGraph

    const result = await restoreDefaultSections(service, { link, query })

    // Só a seção que declara o campo no contrato recebe chips — e ela recebe o
    // que o `defaultFilterIds` resolveu a partir dos handles do padrão.
    expect(result.chips).toEqual(["featured"])
    expect(calls).toEqual(["create:1"])
  })

  /**
   * A outra superfície, pela mesma máquina.
   *
   * A superfície de tema repõe **estações**, não seções: `surface` e `type` são
   * os do contrato e o `data` é o achatamento do tema (rótulo, janela e as
   * cores que ele troca). Se a escolha da lista padrão voltasse a ser única, o
   * botão "Restaurar padrão" da aba do tema criaria `nav`, `hero` e o rodapé
   * dentro de `surface = "theme"` — blocos que nenhum render daquela superfície
   * lê, e que apareceriam como lixo na tela de estações.
   */
  it("na superfície de tema, o que nasce são as estações (e não as seções)", async () => {
    const { createContentSections, service } = fakeService()

    const result = await restoreDefaultSections(service, {
      surface: THEME_SURFACE,
    })
    const rows = createdRows(createContentSections)

    expect(result.created).toEqual(THEME_FILES.map(({ id }) => id))
    expect(rows.every((row) => row.surface === THEME_SURFACE)).toBe(true)
    expect(rows.every((row) => row.type === THEME_TYPE)).toBe(true)
    // Estação não é cromo: ela tem ordem na lista (as setas do CRM), e a coluna
    // não pode dizer o contrário.
    expect(rows.some((row) => row.fixed)).toBe(false)

    const natal = rows.find((row) => row.id === "natal")

    expect(natal?.data.label).toBe("Natal")
    expect(natal?.data.dateRangeStart).toBe("11-15")
    expect(natal?.data[themeColorField("rose")]).toBe("#8E3B3B")
    // O que a estação não troca não é gravado: em branco é herdar o padrão.
    expect(natal?.data[themeColorField("cacao")]).toBeUndefined()
  })
})

/**
 * De qual superfície vem a lista padrão.
 *
 * É a única coisa que muda entre restaurar a vitrine e restaurar o tema, e é
 * uma decisão que não se vê quando está errada: as duas listas têm a forma de
 * `content_section` (id, type, enabled, position e o `data` achatado), então
 * usar a da vitrine na superfície de tema **funciona** — e grava `hero`, `nav` e
 * `footer` numa superfície que só desenha estações.
 */
describe("defaultsFor", () => {
  it("a superfície de tema repõe as estações; a vitrine repõe o protótipo", () => {
    expect(defaultsFor(THEME_SURFACE).map(({ id }) => id)).toEqual(
      THEME_FILES.map(({ id }) => id)
    )
    expect(defaultsFor("home").map(({ id }) => id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(({ id }) => id)
    )
  })

  it("numa superfície de tema vazia, o plano sai na ordem do seed", () => {
    const plan = planRestoredPositions([], defaultsFor(THEME_SURFACE))

    expect(order(plan)).toEqual(THEME_FILES.map(({ id }) => id))
    expect(plan.length).toBe(THEME_FILES.length)
  })

  it("a estação que já existe não é recriada", () => {
    const existing = [{ id: "default", position: 10 }]
    const plan = planRestoredPositions(existing, defaultsFor(THEME_SURFACE))

    expect(plan.map(({ id }) => id)).toEqual(
      THEME_FILES.filter(({ id }) => id !== "default").map(({ id }) => id)
    )
    expect(order([...existing, ...plan])).toEqual(
      THEME_FILES.map(({ id }) => id)
    )
  })
})

