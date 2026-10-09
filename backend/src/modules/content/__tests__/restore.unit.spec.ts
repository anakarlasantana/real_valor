/**
 * A posição com que o "Restaurar padrão" cria cada seção que falta.
 *
 * O que este teste protege é a base que **já passou pelo CRM**: a numeração de
 * hoje é por **casas** (o bloco ancorado em 1, 2, 3, 4 e 10 e a vitrine nas
 * livres — 5 a 9 e, a partir da sexta, 11), e uma base antiga tem a vitrine em
 * 100, 110, 120… (ou em 20, 30, 40…, antes disso).
 * Copiar a posição do padrão ali fazia a seção nova nascer **antes da capa** — o
 * trilho de lançamentos apareceria acima da fotografia de abertura, e nada na
 * tela apontaria o motivo.
 *
 * O caso da base vazia é o outro lado: sem nenhum vizinho, a numeração do
 * padrão é a ordem certa, e ela vale para a lista inteira — inclusive a casa
 * ancorada de cada seção fixa (o rodapé em 10, e não depois da última seção).
 */
import {
  FIXED_SECTION_POSITIONS,
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
  it("numa base migrada (casas por bloco), a seção que falta volta para a casa livre do vizinho", () => {
    // A base como a migration das casas a deixa — o bloco ancorado em 1, 2, 3, 4
    // e 10, e a vitrine nas casas livres —, sem o `lancamentos`: o lojista o
    // apagou, e a casa 5 (a dele no padrão) ficou vazia.
    const existing = [
      { id: "announcement", position: 1 },
      { id: "nav", position: 2 },
      { id: "hero", position: 3 },
      { id: "benefits", position: 4 },
      { id: "collections", position: 6 },
      { id: "editorial", position: 7 },
      { id: "banner", position: 8 },
      { id: "featured", position: 9 },
      { id: "instagram", position: 11 },
      { id: "footer", position: 10 },
    ]

    const plan = planRestoredPositions(existing)

    // O vizinho do `lancamentos` no padrão é a faixa de benefícios (casa 4), e a
    // primeira casa livre depois dela é a 5 — que é onde o trilho aparece.
    expect(plan).toEqual([{ id: "lancamentos", position: 5 }])
    expect(order([...existing, ...plan])).toEqual([
      "announcement",
      "nav",
      "hero",
      "benefits",
      "lancamentos",
      "collections",
      "editorial",
      "banner",
      "featured",
      "footer",
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

  it("sem a vitrine, cada seção entra na casa livre depois do seu vizinho do padrão", () => {
    // Base só com o bloco ancorado: a numeração do padrão vale para a lista
    // inteira, casa por casa — e a do rodapé (10) fica de fora, porque
    // `positionAfter` pula as casas ancoradas.
    const existing = [
      { id: "announcement", position: 1 },
      { id: "nav", position: 2 },
      { id: "hero", position: 3 },
      { id: "benefits", position: 4 },
      { id: "footer", position: 10 },
    ]

    const plan = planRestoredPositions(existing)
    const positions = plan.map(({ position }) => position)

    expect(order([...existing, ...plan])).toEqual([
      "announcement",
      "nav",
      "hero",
      "benefits",
      "lancamentos",
      "collections",
      "editorial",
      "banner",
      "featured",
      "footer",
      "instagram",
    ])
    // As casas livres, na ordem: 5 a 9 e depois 11, porque a casa 10 é do
    // rodapé — nenhuma se repete, e nenhuma cai no bloco ancorado.
    expect(positions).toEqual([5, 6, 7, 8, 9, 11])
    expect(new Set(positions).size).toBe(positions.length)
  })

  it("a seção ancorada que falta volta para a casa dela, e não para depois da última", () => {
    // A capa (3) e o rodapé (10): é a casa que a loja lê sempre, e não "depois
    // do vizinho" — sem esta regra o rodapé nasceria em 11, fora da numeração da
    // home, porque `positionAfter` pula as casas ancoradas.
    const existing = [
      { id: "announcement", position: 1 },
      { id: "nav", position: 2 },
    ]

    const plan = planRestoredPositions(existing)

    expect(plan.find(({ id }) => id === "hero")?.position).toBe(
      FIXED_SECTION_POSITIONS.hero
    )
    expect(plan.find(({ id }) => id === "footer")?.position).toBe(
      FIXED_SECTION_POSITIONS.footer
    )
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

  it("o bloco ancorado que já existe não é recriado", async () => {
    // Numa base em que o cromo já está lá, o que nasce são as seções da vitrine e
    // as fixas que faltam — a capa e a faixa de benefícios —, cada uma com a
    // coluna `fixed` que o contrato manda gravar.
    const existing = [
      { id: "announcement", position: 1 },
      { id: "nav", position: 2 },
      { id: "footer", position: 10 },
    ]
    const { createContentSections, service } = fakeService(existing)

    const result = await restoreDefaultSections(service)
    const rows = createdRows(createContentSections)

    expect(result.kept).toBe(existing.length)
    // O que **já existia** não volta (o `nav`, a barra e o rodapé), e o que
    // nasce fixo é o que faltava do bloco ancorado: a capa e a faixa de
    // benefícios — cada uma na casa que `FIXED_SECTION_POSITIONS` declara.
    expect(rows.filter((row) => row.fixed).map((row) => row.type).sort()).toEqual([
      "benefits",
      "hero",
    ])
    expect(
      rows.find((row) => row.type === "hero")?.position
    ).toBe(FIXED_SECTION_POSITIONS.hero)
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

