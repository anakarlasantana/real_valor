/**
 * A curadoria de produtos: as regras puras, a ordem das escritas e a forma do
 * link.
 * -------------------------------------------------------------------------
 * O que estes testes prendem é o que **não** se vê rodando a API:
 *
 * - a curadoria é **referência** (link), e não texto dentro do `data` — então a
 *   chave `productIds` não pode existir no contrato de nenhum tipo (se existisse,
 *   o `data` teria uma cópia da lista, e a cópia é o defeito);
 * - a ordem é a posição da lista (10, 20, 30…), e não um número que alguém
 *   digita: `position` repetida é ordem indefinida na vitrine;
 * - a escrita **desfaz antes de regravar**: se a segunda chamada falhar, a seção
 *   fica sem curadoria (modo automático) em vez de com uma lista pela metade —
 *   que é a falha que o lojista não veria;
 * - e o link é muitos-para-muitos (`isList: true` nos **dois** lados): sem isso o
 *   próprio `remoteLink.create` recusa o segundo vínculo, e um produto não
 *   poderia estar no "Destaques" e no trilho de lançamentos ao mesmo tempo.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { ITEM_FIELDS, SECTION_FIELDS } from "../contract"
import {
  CURATION_ENTITY,
  CURATION_FIELD,
  curationLinks,
  curationPairs,
  groupCuration,
  removedFromCuration,
  withCuration,
  writeCuration,
  type QueryGraph,
  type RemoteLink,
} from "../curation"
import { FIRST_CURATION_POSITION, curationPositionFor } from "../order"

const linkSource = readFileSync(
  join(__dirname, "..", "..", "..", "links", "content-section-product.ts"),
  "utf8"
)

/** Um `query` de mentira que devolve as linhas do link que o teste quiser. */
const fakeQuery = (
  rows: { content_section_id: string; product_id: string }[]
): QueryGraph => ({
  // O `graph` do container é genérico e tipado pelo framework; aqui ele só
  // precisa devolver o que a curadoria lê (o `data` da resposta).
  graph: (async () => ({ data: rows })) as unknown as QueryGraph["graph"],
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

describe("groupCuration", () => {
  it("agrupa por seção sem reordenar (a ordem é a do banco)", () => {
    const rows = [
      { content_section_id: "lancamentos", product_id: "prod_b" },
      { content_section_id: "featured", product_id: "prod_c" },
      { content_section_id: "lancamentos", product_id: "prod_a" },
    ]

    expect(groupCuration(rows)).toEqual({
      lancamentos: ["prod_b", "prod_a"],
      featured: ["prod_c"],
    })
  })

  it("seção sem link nenhum simplesmente não aparece", () => {
    expect(groupCuration([])).toEqual({})
  })
})

describe("withCuration", () => {
  const section = { id: "featured", type: "featured" }

  it("sem curadoria a chave não sai no payload (é o modo automático)", () => {
    expect(withCuration(section, undefined)).toEqual(section)
    expect(withCuration(section, [])).toEqual(section)
    expect("productIds" in withCuration(section, [])).toBe(false)
  })

  it("com curadoria, a lista vem numa cópia (o payload não é o array de ninguém)", () => {
    const ids = ["prod_a", "prod_b"]

    const withProducts = withCuration(section, ids)

    expect(withProducts).toEqual({ ...section, productIds: ids })
    expect(withProducts.productIds).not.toBe(ids)
  })
})

describe("curationLinks", () => {
  it("a ordem da lista vira posição (10, 20, 30…)", () => {
    expect(curationLinks("featured", ["prod_a", "prod_b"])).toEqual([
      {
        product: { product_id: "prod_a" },
        content: { content_section_id: "featured" },
        data: { position: 10 },
      },
      {
        product: { product_id: "prod_b" },
        content: { content_section_id: "featured" },
        data: { position: 20 },
      },
    ])
  })

  it("a faixa da curadoria começa na folga, não na faixa das seções", () => {
    expect(FIRST_CURATION_POSITION).toBe(10)
    expect([0, 1, 2].map(curationPositionFor)).toEqual([10, 20, 30])
    // A vitrine começa em 100 (a faixa do cromo é abaixo): se a curadoria
    // começasse lá, o `\d` das duas tabelas contaria a mesma história.
    expect(curationPositionFor(0)).toBeLessThan(FIRST_CURATION_POSITION + 100)
  })

  it("sem produto não há link para gravar", () => {
    expect(curationLinks("featured", [])).toEqual([])
  })
})

describe("curationPairs e removedFromCuration", () => {
  it("o par que sai não leva `data`: desfazer não escreve posição", () => {
    expect(
      curationPairs("featured", ["prod_a"]).every((pair) => !("data" in pair))
    ).toBe(true)
  })

  it("o que saiu é o que estava e não está mais", () => {
    expect(removedFromCuration(["a", "b", "c"], ["c", "a"])).toEqual(["b"])
    expect(removedFromCuration(["a"], [])).toEqual(["a"])
    expect(removedFromCuration([], ["a"])).toEqual([])
    expect(removedFromCuration(["a"], ["a"])).toEqual([])
  })
})

describe("writeCuration", () => {
  it("a lista manda: desfaz o que saiu e regrava o que ficou", async () => {
    const calls: string[] = []

    await writeCuration({
      link: fakeLink(calls),
      query: fakeQuery([
        { content_section_id: "featured", product_id: "prod_a" },
        { content_section_id: "featured", product_id: "prod_b" },
      ]),
      sectionId: "featured",
      productIds: ["prod_b", "prod_c"],
    })

    // Desfazer **antes** de gravar: se a segunda chamada falhar, a seção fica
    // sem curadoria (modo automático) e não com uma lista pela metade.
    expect(calls).toEqual(["dismiss:1", "create:2"])
  })

  it("nada saiu: nenhum `dismiss` (reordenar é só upsert)", async () => {
    const calls: string[] = []

    await writeCuration({
      link: fakeLink(calls),
      query: fakeQuery([
        { content_section_id: "featured", product_id: "prod_a" },
        { content_section_id: "featured", product_id: "prod_b" },
      ]),
      sectionId: "featured",
      productIds: ["prod_b", "prod_a"],
    })

    expect(calls).toEqual(["create:2"])
  })

  it("lista vazia esvazia a curadoria e não grava nada", async () => {
    const calls: string[] = []

    await writeCuration({
      link: fakeLink(calls),
      query: fakeQuery([
        { content_section_id: "featured", product_id: "prod_a" },
      ]),
      sectionId: "featured",
      productIds: [],
    })

    expect(calls).toEqual(["dismiss:1"])
  })
})

describe("a curadoria não é conteúdo", () => {
  it("nenhum tipo do contrato declara `productIds` (a lista não mora no `data`)", () => {
    const declared = [
      ...Object.values(SECTION_FIELDS).flat(),
      ...Object.values(ITEM_FIELDS).flat(),
    ].map((field) => field.name)

    expect(declared).not.toContain(CURATION_FIELD)
  })
})

describe("a forma do link", () => {
  it("é o link do Medusa, com tabela própria, `position` e muitos-para-muitos", () => {
    expect(linkSource).toContain("defineLink(")
    expect(linkSource).toContain('table: "content_section_product"')
    expect(linkSource).toContain(
      'position: { type: "integer", defaultValue: "0" }'
    )
    // Um lado sem `isList` faz o próprio `remoteLink.create` recusar o segundo
    // vínculo ("Cannot create multiple links between product and content"): um
    // produto não poderia estar em duas seções.
    expect(linkSource.match(/linkable: [^\n]*isList: true/g)).toHaveLength(2)
  })

  it("o produto é o lado esquerdo — é dele que sai o nome da entidade", () => {
    // `defineLink` compõe o alias com os dois módulos na ordem declarada
    // (`product` + `content_section`), e é esse nome que o `query.graph` usa.
    // Trocar os lados mudaria o nome, e a curadoria passaria a ler vazio sem
    // nenhum erro — por isso o nome está aqui, junto do arquivo que o produz.
    expect(linkSource.indexOf("ProductModule.linkable.product")).toBeLessThan(
      linkSource.indexOf("ContentModule.linkable.contentSection")
    )
    expect(CURATION_ENTITY).toBe("product_content_section")
  })
})