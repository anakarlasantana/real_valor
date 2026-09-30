/**
 * A validação e os resolvedores do corpo do CRM.
 * -------------------------------------------------------------------------
 * Ficavam dentro da rota (`api/admin/content/route.ts`), onde só um `curl`
 * contra o servidor os exercitava. Aqui são funções puras — ou quase, com um
 * `query` de mentira — e o que estes testes prendem é o que a rota não diz
 * sozinha:
 *
 * - **campo desconhecido** é erro, e isso vale para a **referência** também
 *   (`filters` num tipo que não tem chips);
 * - **`list:` exige lista** — o `kind` do campo decide, e é o mesmo caminho para
 *   o `data` e para a referência;
 * - **obrigatório só no POST** (`strict`): no PATCH, campo ausente mantém o que
 *   está gravado;
 * - a faixa do número vem do **campo** (`min`/`max` no contrato), e a lista
 *   fechada (`select`/`color`/`font`) compara com `options`;
 * - `undefined` e `[]` são coisas diferentes nas duas listas de referência:
 *   "não mexe" contra "esvazia" — o que faz um PATCH de texto não apagar a
 *   curadoria nem os chips de ninguém;
 * - a **âncora** (`id`) é validada como apelido e precisa estar livre: ela é o
 *   `id` da linha e o fragmento que o menu usa.
 */
import { SECTION_FIELDS, THEME_FIELDS, THEME_SURFACE, THEME_TYPE } from "../contract"
import type { QueryGraph } from "../curation"
import {
  readPosition,
  resolveCategoryIds,
  resolveProductIds,
  resolveSectionId,
} from "../resolvers"
import type ContentModuleService from "../service"
import { isKnownType, resolveSurface, validateData } from "../validation"
import { toSection } from "../view"

/** Um `query` de mentira que responde por entidade, como o do container. */
const fakeQuery = (answers: Record<string, unknown[]>): QueryGraph => ({
  graph: (async ({ entity }: { entity: string }) => ({
    data: answers[entity] ?? [],
  })) as unknown as QueryGraph["graph"],
})

/** O serviço de mentira do `resolveSectionId`: só a leitura que ele faz. */
const fakeService = (taken: readonly string[] = []) =>
  ({
    listContentSections: async () => taken.map((id) => ({ id })),
  }) as unknown as ContentModuleService

describe("validateData", () => {
  /**
   * O `strict` fica **fora** por padrão nestes testes: cada um isola uma regra, e
   * com ele ligado toda expectativa carregaria também o "obrigatório ausente" do
   * tipo. O PATCH é este caso (`strict: false`), e o POST tem teste próprio.
   */
  const base = { strict: false, fields: SECTION_FIELDS }

  it("não reprova o corpo válido do tipo", () => {
    expect(validateData("featured", { title: "Peças" }, base)).toEqual([])
  })

  it("reprova campo desconhecido, com o nome do campo", () => {
    expect(validateData("featured", { inventado: 1 }, base)).toEqual([
      'Campo desconhecido para "featured": "inventado".',
    ])
  })

  it("a referência passa pela mesma porta: `filters` num tipo sem chips é erro", () => {
    expect(
      validateData("hero", {}, { ...base, references: { filters: [] } })
    ).toEqual(['Campo desconhecido para "hero": "filters".'])
    expect(
      validateData("featured", {}, { ...base, references: { filters: [] } })
    ).toEqual([])
  })

  it("`list:` exige lista — no `data` e na referência", () => {
    expect(validateData("benefits", { items: "x" }, base)).toContain(
      'Campo "items" deve ser uma lista.'
    )
    expect(
      validateData("featured", {}, { ...base, references: { filters: "x" } })
    ).toEqual(['Campo "filters" deve ser uma lista.'])
  })

  it("o obrigatório só é cobrado no POST (`strict`)", () => {
    expect(validateData("featured", {}, { ...base, strict: true })).toEqual([
      'Campo obrigatório ausente: "title".',
    ])
    expect(validateData("featured", {}, base)).toEqual([])
  })

  it("a faixa do número vem do campo do contrato", () => {
    expect(validateData("launches", { limit: 999 }, base)).toContain(
      'Campo "limit" não pode ser maior que 12.'
    )
    expect(validateData("launches", { limit: 8 }, base)).toEqual([])
  })

  it("a lista fechada compara com `options` e nomeia a opção vazia", () => {
    const errors = validateData(
      "featured",
      { appearanceHeadingColor: "rosa" },
      base
    )

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("(vazio = padrão do tema)")
    // O valor vazio é "segue o tema" — não é erro.
    expect(validateData("featured", { appearanceHeadingColor: "" }, base)).toEqual(
      []
    )
  })

  it("tipo sem campos no schema é erro de contrato, não de dado", () => {
    expect(validateData("inventado", {}, base)).toEqual([
      'O tipo "inventado" não tem campos no schema gravado ' +
        "(backend/src/modules/content/schema.ts).",
    ])
  })
})

describe("isKnownType", () => {
  const schema = { types: ["hero", "featured"] } as never

  it("aceita o que o registro declara e recusa o resto", () => {
    expect(isKnownType("hero", schema)).toBe(true)
    expect(isKnownType("inventado", schema)).toBe(false)
    expect(isKnownType(7, schema)).toBe(false)
    expect(isKnownType(undefined, schema)).toBe(false)
  })
})

describe("readPosition", () => {
  it("ausente não é erro (cada rota decide o que fazer)", () => {
    expect(readPosition(undefined)).toEqual({})
    expect(readPosition(null)).toEqual({})
  })

  it("número em texto vira número", () => {
    expect(readPosition("30")).toEqual({ position: 30 })
  })

  it("texto que não é número é erro com o nome do campo", () => {
    // `Number("abc")` é `NaN`, e `NaN` na coluna não dá erro: dá ordem
    // indefinida na vitrine, sem nada acusar.
    expect(readPosition("abc").error).toBe(
      'Campo "position" deve ser um número.'
    )
  })
})

describe("toSection", () => {
  it("achata `data` no nível raiz e mantém as colunas de controle", () => {
    expect(
      toSection({
        id: "hero",
        enabled: true,
        position: 100,
        fixed: false,
        type: "hero",
        data: { headline: "Você não precisa ser rica" },
      })
    ).toEqual({
      id: "hero",
      enabled: true,
      position: 100,
      fixed: false,
      type: "hero",
      headline: "Você não precisa ser rica",
    })
  })

  it("seção sem `data` sai só com as colunas", () => {
    expect(
      toSection({
        id: "x",
        enabled: false,
        position: 10,
        fixed: true,
        type: "nav",
        data: null,
      })
    ).toEqual({
      id: "x",
      enabled: false,
      position: 10,
      fixed: true,
      type: "nav",
    })
  })
})


describe("resolveProductIds", () => {
  it("ausente não mexe; vazio esvazia", async () => {
    expect(await resolveProductIds(undefined, fakeQuery({}))).toEqual({})
    expect(await resolveProductIds([], fakeQuery({}))).toEqual({ ids: [] })
  })

  it("recusa o que não é lista de ids", async () => {
    expect((await resolveProductIds("prod_a", fakeQuery({}))).error).toContain(
      "deve ser uma lista de ids de produto"
    )
    expect((await resolveProductIds([""], fakeQuery({}))).error).toContain(
      "deve ser uma lista de ids de produto"
    )
  })

  it("recusa id repetido (a lista é ordenada, cada produto uma vez)", async () => {
    expect(
      (await resolveProductIds(["prod_a", "prod_a"], fakeQuery({}))).error
    ).toContain("id repetido")
  })

  it("recusa id que não existe — a tabela do link não tem FK", async () => {
    const query = fakeQuery({ product: [{ id: "prod_a" }] })

    expect(await resolveProductIds(["prod_a"], query)).toEqual({
      ids: ["prod_a"],
    })
    expect(
      (await resolveProductIds(["prod_a", "prod_fantasma"], query)).error
    ).toContain("prod_fantasma")
  })
})

describe("resolveCategoryIds", () => {
  it("ausente não mexe; vazio esvazia os chips", async () => {
    expect(await resolveCategoryIds(undefined, fakeQuery({}))).toEqual({})
    expect(await resolveCategoryIds([], fakeQuery({}))).toEqual({ ids: [] })
  })

  it("recusa o que não é lista de ids de categoria", async () => {
    expect((await resolveCategoryIds(7, fakeQuery({}))).error).toContain(
      "deve ser uma lista de ids de categoria"
    )
  })

  it("recusa id repetido", async () => {
    expect(
      (await resolveCategoryIds(["pcat_a", "pcat_a"], fakeQuery({}))).error
    ).toContain("id repetido")
  })

  it("recusa categoria que não existe (é o buraco que o chip 'Blazers' era)", async () => {
    const query = fakeQuery({
      product_category: [{ id: "pcat_a", name: "Vestidos", handle: "vestidos" }],
    })

    expect(await resolveCategoryIds(["pcat_a"], query)).toEqual({
      ids: ["pcat_a"],
    })
    expect(
      (await resolveCategoryIds(["pcat_a", "pcat_fantasma"], query)).error
    ).toContain("pcat_fantasma")
  })
})

describe("resolveSectionId", () => {
  it("sem `id` no corpo, quem gera é o banco", async () => {
    expect(await resolveSectionId(undefined, fakeService())).toEqual({})
    expect(await resolveSectionId("", fakeService())).toEqual({})
  })

  it("aceita apelido livre", async () => {
    expect(await resolveSectionId("destaques-2", fakeService())).toEqual({
      id: "destaques-2",
    })
  })

  it("recusa o que não é apelido (ele vira fragmento de URL)", async () => {
    expect((await resolveSectionId("Destaques", fakeService())).error).toContain(
      "apelido"
    )
    expect(
      (await resolveSectionId("com espaço", fakeService())).error
    ).toContain("apelido")
  })

  it("recusa id já tomado — dois blocos com o mesmo id rolariam para o lugar errado", async () => {
    expect((await resolveSectionId("hero", fakeService(["hero"]))).error).toBe(
      'Já existe uma seção com o id "hero".'
    )
  })
})

/**
 * A superfície de cada bloco.
 *
 * A `surface` é a coluna que separa a vitrine do tema, e quem a decide é a API
 * — não o corpo. Um `theme` gravado em `home` chegaria ao render da vitrine como
 * tipo desconhecido (a loja descarta e loga) e a estação sumiria; um `hero`
 * gravado em `theme` seria uma linha que nenhum render daquela superfície lê. Os
 * dois casos são lixo silencioso, e é por isso que a regra está aqui, com teste
 * próprio, em vez de espalhada em `if` na rota.
 */
describe("resolveSurface", () => {
  it("o bloco de tema nasce na superfície `theme`, mesmo sem o corpo dizer", () => {
    expect(resolveSurface(undefined, THEME_TYPE)).toEqual({
      surface: THEME_SURFACE,
    })
    // Nem se o corpo insistir em outra superfície: quem manda é o contrato.
    expect(resolveSurface("home", THEME_TYPE)).toEqual({
      surface: THEME_SURFACE,
    })
  })

  it("seção na superfície de tema é recusada, com as duas no aviso", () => {
    const { error } = resolveSurface(THEME_SURFACE, "hero")

    expect(error).toContain(THEME_SURFACE)
    expect(error).toContain(THEME_TYPE)
  })

  it("a superfície da seção é a que veio no corpo; ausente é 'não mexe'", () => {
    expect(resolveSurface("home", "hero")).toEqual({ surface: "home" })
    // Vazio não é superfície: o PATCH de um texto não reescreve a coluna (e o
    // POST cai no `home`, que é o default do modelo).
    expect(resolveSurface("", "hero")).toEqual({})
    expect(resolveSurface(undefined, "hero")).toEqual({})
  })
})

/**
 * O formato do campo (`pattern`).
 *
 * É o que o `kind` sozinho não descreve: um `hex` de cinco dígitos seria aceito
 * como texto, gravado, e chegaria à loja como variável CSS inválida — o `var()`
 * não cai no fallback quando a variável existe e não resolve, então a cor
 * sumiria sem erro nenhum. O mesmo para a janela da estação, que o storefront
 * compara com o dia de hoje como `MM-DD`.
 */
describe("o formato do campo (`pattern`)", () => {
  /** O `fields` como a API o recebe: o registro, já com o tema (v6). */
  const theme = { strict: false, fields: { theme: THEME_FIELDS } }

  it("recusa cor fora de `#RRGGBB`, com o nome do campo", () => {
    expect(
      validateData("theme", { colorRose: "#B97872" }, theme)
    ).toEqual([])
    expect(validateData("theme", { colorRose: "#B9787" }, theme)[0]).toContain(
      "colorRose"
    )
    expect(validateData("theme", { colorRose: "rose" }, theme)[0]).toContain(
      "colorRose"
    )
  })

  it("recusa janela fora de `MM-DD`", () => {
    expect(
      validateData("theme", { dateRangeStart: "11-20" }, theme)
    ).toEqual([])
    expect(
      validateData("theme", { dateRangeStart: "13-01" }, theme)[0]
    ).toContain("dateRangeStart")
  })

  it("em branco não é erro: é 'herda o tema padrão'", () => {
    expect(
      validateData("theme", { colorRose: "", dateRangeStart: "" }, theme)
    ).toEqual([])
  })

  it("no POST, a estação precisa de nome (é o que a lista mostra)", () => {
    expect(
      validateData("theme", {}, { strict: true, fields: theme.fields })
    ).toEqual(['Campo obrigatório ausente: "label".'])
  })
})

