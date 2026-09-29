/**
 * Os chips de filtro: as regras puras, a ordem das escritas, a forma do link e a
 * conversão de uma base anterior à R1.
 * -------------------------------------------------------------------------
 * O que estes testes prendem é o que **não** se vê rodando a API:
 *
 * - o chip é **referência** (link), e não texto dentro do `data`: o valor é o id
 *   da categoria, e o rótulo é lido ao vivo — é o que faz o chip acompanhar uma
 *   categoria renomeada no painel;
 * - a ordem é a posição da lista (10, 20, 30…), como na curadoria: `position`
 *   repetida é ordem indefinida na vitrine;
 * - a escrita **desfaz antes de regravar**, pelo mesmo motivo da curadoria;
 * - o link é muitos-para-muitos (`isList: true` nos dois lados), senão o próprio
 *   `remoteLink.create` recusa a segunda seção com o mesmo chip;
 * - o padrão aponta para as categorias por **handle** (o id é criado pelo seed a
 *   cada base), e um handle que não existe encolhe a lista em vez de derrubar o
 *   seed.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { SECTION_FIELDS } from "../contract"
import type { QueryGraph, RemoteLink } from "../curation"
import { DEFAULT_FEATURED_FILTERS, DEFAULT_HOME_SECTIONS } from "../defaults"
import {
  FILTERS_ENTITY,
  FILTERS_FIELD,
  defaultFilterIds,
  filterLinks,
  filterPairs,
  groupFilters,
  hasChips,
  readChips,
  removedFromFilters,
  retireTextFilters,
  withFilters,
  writeFilters,
} from "../filters"

const linkSource = readFileSync(
  join(__dirname, "..", "..", "..", "links", "content-section-category.ts"),
  "utf8"
)

/**
 * Um `query` de mentira que responde **por entidade**.
 *
 * São duas leituras no mesmo fluxo — as linhas do link e as categorias —, e o
 * teste precisa das duas para conferir que o rótulo vem do catálogo, e não da
 * lista.
 */
const fakeQuery = (answers: Record<string, unknown[]>): QueryGraph => ({
  graph: (async ({ entity }: { entity: string }) => ({
    data: answers[entity] ?? [],
  })) as unknown as QueryGraph["graph"],
})

/** Um `remoteLink` de mentira que anota a ordem das chamadas. */
const fakeLink = (calls: string[]) =>
  ({
    create: async (links) => {
      calls.push(`create:${links.length}`)
      return links
    },
    dismiss: async (links) => {
      calls.push(`dismiss:${links.length}`)
      return links
    },
    delete: async () => {
      calls.push("delete")
      return []
    },
  }) as RemoteLink

/** Uma linha do link, no formato que o `query.graph` devolve. */
const row = (sectionId: string, categoryId: string) => ({
  content_section_id: sectionId,
  product_category_id: categoryId,
})

const category = (id: string, name: string, handle: string) => ({
  id,
  name,
  handle,
})

describe("groupFilters", () => {
  it("agrupa por seção sem reordenar (a ordem é a do banco)", () => {
    const rows = [
      row("featured", "pcat_b"),
      row("outra", "pcat_c"),
      row("featured", "pcat_a"),
    ]

    expect(groupFilters(rows)).toEqual({
      featured: ["pcat_b", "pcat_a"],
      outra: ["pcat_c"],
    })
  })

  it("seção sem chip nenhum simplesmente não aparece", () => {
    expect(groupFilters([])).toEqual({})
  })
})

describe("withFilters", () => {
  const section = { id: "featured", type: "featured" }
  const chips = [{ categoryId: "pcat_a", label: "Vestidos", handle: "vestidos" }]

  it("sem chips a chave não sai no payload (vitrine do catálogo inteiro)", () => {
    expect(withFilters(section, undefined)).toEqual(section)
    expect(withFilters(section, [])).toEqual(section)
    expect(FILTERS_FIELD in withFilters(section, [])).toBe(false)
  })

  it("com chips, a lista vem numa cópia (o payload não é o array de ninguém)", () => {
    const merged = withFilters(section, chips)

    expect(merged.filters).toEqual(chips)
    expect(merged.filters).not.toBe(chips)
  })

  it("a chave aposentada do `data` não chega ao payload", () => {
    // Base anterior à R1: o `listSections` achata o `data` no nível raiz, então
    // os chips de **texto** apareceriam com a mesma chave do link. Uma string
    // não tem `label` nem `handle` — o chip viraria um botão que não filtra
    // nada, que é o defeito que a fase conserta.
    const legacy = { ...section, filters: ["Todos", "Blazers"] }

    expect(withFilters(legacy, undefined)).toEqual(section)
    expect(withFilters(legacy, [])).toEqual(section)
    expect(withFilters(legacy, chips).filters).toEqual(chips)
  })
})

describe("filterLinks", () => {
  it("a ordem da lista vira posição (10, 20, 30…)", () => {
    expect(filterLinks("featured", ["pcat_a", "pcat_b"])).toEqual([
      {
        product: { product_category_id: "pcat_a" },
        content: { content_section_id: "featured" },
        data: { position: 10 },
      },
      {
        product: { product_category_id: "pcat_b" },
        content: { content_section_id: "featured" },
        data: { position: 20 },
      },
    ])
  })

  it("sem categoria não há link para gravar", () => {
    expect(filterLinks("featured", [])).toEqual([])
  })

  it("o par a desvincular não leva `data` (é remoção, não gravação)", () => {
    expect(filterPairs("featured", ["pcat_a"])).toEqual([
      {
        product: { product_category_id: "pcat_a" },
        content: { content_section_id: "featured" },
      },
    ])
  })
})

describe("removedFromFilters", () => {
  it("o que saiu é o que estava e não está mais", () => {
    expect(removedFromFilters(["a", "b", "c"], ["c", "a"])).toEqual(["b"])
    expect(removedFromFilters(["a"], [])).toEqual(["a"])
    expect(removedFromFilters([], ["a"])).toEqual([])
    expect(removedFromFilters(["a"], ["a"])).toEqual([])
  })
})

describe("readChips", () => {
  it("o rótulo vem do catálogo, não da lista (categoria renomeada muda o chip)", async () => {
    const chips = await readChips(
      fakeQuery({
        [FILTERS_ENTITY]: [row("featured", "pcat_b"), row("featured", "pcat_a")],
        product_category: [
          // O banco devolve em qualquer ordem: quem manda é a lista.
          category("pcat_a", "Vestidos", "vestidos"),
          category("pcat_b", "Conjuntos", "conjuntos"),
        ],
      }),
      ["featured"]
    )

    expect(chips.featured).toEqual([
      { categoryId: "pcat_b", label: "Conjuntos", handle: "conjuntos" },
      { categoryId: "pcat_a", label: "Vestidos", handle: "vestidos" },
    ])
  })

  it("categoria que sumiu do catálogo não vira chip (a lista encolhe)", async () => {
    const chips = await readChips(
      fakeQuery({
        [FILTERS_ENTITY]: [row("featured", "pcat_fantasma")],
        product_category: [],
      }),
      ["featured"]
    )

    expect(chips.featured).toEqual([])
  })
})

describe("defaultFilterIds", () => {
  it("resolve os handles do padrão na ordem declarada", async () => {
    const ids = await defaultFilterIds(
      fakeQuery({
        product_category: [
          category("pcat_c", "Conjuntos", "conjuntos"),
          category("pcat_v", "Vestidos", "vestidos"),
          category("pcat_b", "Blusas & Camisas", "blusas-camisas"),
          category("pcat_a", "Calças & Alfaiataria", "calcas-alfaiataria"),
        ],
      })
    )

    expect(ids).toEqual(["pcat_v", "pcat_b", "pcat_a", "pcat_c"])
    // A lista é a do contrato — se ela mudar de tamanho, é aqui que se vê.
    expect(DEFAULT_FEATURED_FILTERS).toHaveLength(4)
  })

  it("handle que não existe encolhe a lista em vez de derrubar o seed", async () => {
    const ids = await defaultFilterIds(
      fakeQuery({
        product_category: [category("pcat_v", "Vestidos", "vestidos")],
      })
    )

    expect(ids).toEqual(["pcat_v"])
  })
})

describe("writeFilters", () => {
  it("a lista manda: desfaz o que saiu e regrava o que ficou", async () => {
    const calls: string[] = []

    await writeFilters({
      link: fakeLink(calls),
      query: fakeQuery({
        [FILTERS_ENTITY]: [row("featured", "pcat_a"), row("featured", "pcat_b")],
      }),
      sectionId: "featured",
      categoryIds: ["pcat_b", "pcat_c"],
    })

    expect(calls).toEqual(["dismiss:1", "create:2"])
  })

  it("nada saiu: nenhum `dismiss` (reordenar é só upsert)", async () => {
    const calls: string[] = []

    await writeFilters({
      link: fakeLink(calls),
      query: fakeQuery({
        [FILTERS_ENTITY]: [row("featured", "pcat_a"), row("featured", "pcat_b")],
      }),
      sectionId: "featured",
      categoryIds: ["pcat_b", "pcat_a"],
    })

    expect(calls).toEqual(["create:2"])
  })

  it("lista vazia esvazia os chips e não grava nada", async () => {
    const calls: string[] = []

    await writeFilters({
      link: fakeLink(calls),
      query: fakeQuery({ [FILTERS_ENTITY]: [row("featured", "pcat_a")] }),
      sectionId: "featured",
      categoryIds: [],
    })

    expect(calls).toEqual(["dismiss:1"])
  })
})

describe("hasChips", () => {
  it("é o tipo que declara o campo de chips no contrato", () => {
    expect(hasChips("featured")).toBe(true)
    expect(hasChips("hero")).toBe(false)
    expect(hasChips("inexistente")).toBe(false)
  })
})


describe("retireTextFilters", () => {
  /** O serviço de mentira: só o `update` que a conversão usa. */
  const fakeService = () => {
    const updateContentSections = jest.fn(async (rows: unknown) => rows)

    return { updateContentSections, service: { updateContentSections } }
  }

  const legacySection = {
    id: "featured",
    type: "featured",
    data: { title: "Peças em destaque", filters: ["Todos", "Blazers"] },
  }

  /** As quatro categorias do seed, como o `query` as devolve. */
  const catalog = [
    category("pcat_v", "Vestidos", "vestidos"),
    category("pcat_b", "Blusas & Camisas", "blusas-camisas"),
    category("pcat_a", "Calças & Alfaiataria", "calcas-alfaiataria"),
    category("pcat_c", "Conjuntos", "conjuntos"),
  ]

  it("tira a chave antiga do `data` e liga os chips do padrão", async () => {
    const calls: string[] = []
    const { updateContentSections, service } = fakeService()

    const result = await retireTextFilters({
      service,
      link: fakeLink(calls),
      query: fakeQuery({ [FILTERS_ENTITY]: [], product_category: catalog }),
      sections: [legacySection],
    })

    // A chave é **neutralizada**, e não removida do objeto: o update do serviço
    // mescla o JSON da coluna (medido em 2026-09-29), então gravar o `data` sem
    // ela a deixaria onde está. `null` diz "não há nada aqui", e a leitura
    // descarta a chave (`withFilters`) — a loja não vê o resto.
    expect(updateContentSections).toHaveBeenCalledWith([
      { id: "featured", data: { filters: null } },
    ])
    expect(result).toEqual({ cleaned: ["featured"], chipped: ["featured"] })
    expect(calls).toEqual(["create:4"])
  })

  it("seção que já tem chips não é tocada (a escolha do lojista fica)", async () => {
    const calls: string[] = []
    const { service } = fakeService()

    const result = await retireTextFilters({
      service,
      link: fakeLink(calls),
      query: fakeQuery({
        [FILTERS_ENTITY]: [row("featured", "pcat_a")],
        product_category: catalog,
      }),
      sections: [legacySection],
    })

    expect(result).toEqual({ cleaned: ["featured"], chipped: [] })
    expect(calls).toEqual([])
  })

  it("base já convertida não grava nada (nem `data`, nem link)", async () => {
    const calls: string[] = []
    const { updateContentSections, service } = fakeService()

    const result = await retireTextFilters({
      service,
      link: fakeLink(calls),
      query: fakeQuery({}),
      sections: [{ id: "hero", type: "hero", data: { headline: "Oi" } }],
    })

    expect(result).toEqual({ cleaned: [], chipped: [] })
    expect(updateContentSections).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })
})

describe("o chip não é conteúdo", () => {
  it("o campo `filters` do contrato é uma referência (`list:category`)", () => {
    const field = (SECTION_FIELDS.featured ?? []).find(
      (spec) => spec.name === FILTERS_FIELD
    )

    expect(field?.kind).toBe("list:category")
  })

  it("o conteúdo padrão não guarda chip nenhum (o \"Blazers\" não existe)", () => {
    // A seção do padrão não tem `filters`: o chip é referência e só existe
    // depois da seção, no link. O que estava aqui era a cópia — e uma das
    // categorias dela não existia no catálogo, então aquele chip devolvia zero
    // peças em silêncio.
    const featured = DEFAULT_HOME_SECTIONS.find(
      (section) => section.type === "featured"
    )

    expect(featured).toBeDefined()
    expect(FILTERS_FIELD in (featured as object)).toBe(false)
  })
})

describe("a forma do link", () => {
  it("é o link do Medusa, com tabela própria, `position` e muitos-para-muitos", () => {
    expect(linkSource).toContain("defineLink(")
    expect(linkSource).toContain('table: "content_section_category"')
    expect(linkSource).toContain(
      'position: { type: "integer", defaultValue: "0" }'
    )
    // Um lado sem `isList` faz o próprio `remoteLink.create` recusar o segundo
    // vínculo: a mesma categoria não poderia ser chip de duas seções.
    expect(linkSource.match(/linkable: [^\n]*isList: true/g)).toHaveLength(2)
  })

  it("a categoria é o lado esquerdo — é dela que sai o nome da entidade", () => {
    // `defineLink` compõe o alias com os dois lados na ordem declarada
    // (`product_category` + `content_section`), e é esse nome que o
    // `query.graph` usa. Trocar os lados mudaria o nome, e a leitura passaria a
    // devolver vazio — a vitrine **sem chips**, e sem nenhum erro.
    expect(
      linkSource.indexOf("ProductModule.linkable.productCategory")
    ).toBeLessThan(linkSource.indexOf("ContentModule.linkable.contentSection"))
    expect(FILTERS_ENTITY).toBe("product_category_content_section")
  })
})

