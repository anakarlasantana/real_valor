/**
 * Quem do catálogo entra no `sitemap.xml`, sem rede.
 *
 * A regra que se prova aqui é a mesma do 404: **não se anuncia o que não abre**.
 */
import { describe, expect, it } from "vitest"

import {
  caminhoDoProduto,
  enderecoDaEntrada,
  gruposDoCatalogo,
  produtosDoCatalogo,
} from "../sitemap-catalog"

/** Um produto comprável: um variant com estoque. */
const disponivel = {
  handle: "camisa",
  variants: [{ manage_inventory: true, inventory_quantity: 4 }],
}

describe("produtosDoCatalogo", () => {
  it("inclui a peça com estoque, com caminho e prioridade", () => {
    const [entrada] = produtosDoCatalogo([disponivel])

    expect(entrada.path).toBe("/products/camisa")
    expect(entrada.priority).toBe(0.8)
    expect(entrada.changeFrequency).toBe("weekly")
  })

  it("exclui a peça esgotada — a régua é a de `productStatus`", () => {
    const esgotado = {
      handle: "vestido",
      variants: [{ manage_inventory: true, inventory_quantity: 0 }],
    }

    expect(produtosDoCatalogo([esgotado])).toEqual([])
  })

  it("inclui a peça sob demanda: ela é comprável", () => {
    const sobDemanda = {
      handle: "jaqueta",
      variants: [{ manage_inventory: true, allow_backorder: true }],
    }

    expect(produtosDoCatalogo([sobDemanda])).toHaveLength(1)
  })

  it("exclui a peça sem `handle`: sem endereço ela não abre", () => {
    expect(
      produtosDoCatalogo([{ ...disponivel, handle: null }, { ...disponivel, handle: "" }])
    ).toEqual([])
  })

  it("lê o `updated_at` como `lastModified`", () => {
    const [entrada] = produtosDoCatalogo([
      { ...disponivel, updated_at: "2026-10-01T12:00:00.000Z" },
    ])

    expect(entrada.lastModified?.toISOString()).toBe("2026-10-01T12:00:00.000Z")
  })

  it("não emite `lastModified` quando a data é inválida", () => {
    const [entrada] = produtosDoCatalogo([
      { ...disponivel, updated_at: "não é data" },
    ])

    expect(entrada.lastModified).toBeUndefined()
  })

  it("preserva a ordem do catálogo", () => {
    const saida = produtosDoCatalogo([
      { ...disponivel, handle: "a" },
      { ...disponivel, handle: "b" },
    ])

    expect(saida.map((entrada) => entrada.path)).toEqual([
      "/products/a",
      "/products/b",
    ])
  })
})

describe("gruposDoCatalogo", () => {
  const grupos = [
    { handle: "camisas" },
    { handle: "calcas" },
    { handle: null },
  ]

  it("entra só o grupo com peça dentro", () => {
    const saida = gruposDoCatalogo("categories", grupos, new Set(["camisas"]))

    expect(saida.map((entrada) => entrada.path)).toEqual([
      "/categories/camisas",
    ])
  })

  it("monta o caminho da coleção", () => {
    const saida = gruposDoCatalogo("collections", grupos, new Set(["calcas"]))

    expect(saida[0].path).toBe("/collections/calcas")
  })

  it("não inclui grupo sem `handle`, mesmo marcado como cheio", () => {
    const saida = gruposDoCatalogo("categories", grupos, new Set([""]))

    expect(saida).toEqual([])
  })

  it("a prioridade é parametrizável — coleção pesa menos que produto", () => {
    const saida = gruposDoCatalogo("collections", grupos, new Set(["camisas"]), 0.5)

    expect(saida[0].priority).toBe(0.5)
  })
})

describe("endereços", () => {
  it("monta o caminho do produto", () => {
    expect(caminhoDoProduto("camisa-azul")).toBe("/products/camisa-azul")
  })

  it("prefixa o país no endereço final", () => {
    expect(
      enderecoDaEntrada("https://realvalor.com.br", "br", "/products/camisa")
    ).toBe("https://realvalor.com.br/br/products/camisa")
  })
})
