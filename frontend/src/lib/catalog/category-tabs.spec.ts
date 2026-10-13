import { describe, expect, it } from "vitest"

import { abasDoCatalogo } from "./category-tabs"

describe("abasDoCatalogo", () => {
  const raiz = { name: "Vestidos", handle: "vestidos" }
  const filha = { name: "Midi", handle: "midi", parent_category: { id: "cat_1" } }

  it("começa em Todas, apontando para o catálogo inteiro", () => {
    expect(abasDoCatalogo([])[0]).toEqual({ label: "Todas", href: "/store" })
  })

  it("lista as categorias de raiz, e só elas", () => {
    const abas = abasDoCatalogo([raiz, filha])

    expect(abas.map((aba) => aba.label)).toEqual(["Todas", "Vestidos"])
  })

  it("desce um nível: as filhas da categoria atual entram na barra", () => {
    const abas = abasDoCatalogo(
      [raiz, filha],
      { ...raiz, category_children: [filha] }
    )

    expect(abas.map((aba) => aba.label)).toEqual(["Todas", "Vestidos", "Midi"])
    expect(abas[2].href).toBe("/categories/midi")
  })

  it("não repete a categoria que já está na barra, nem aba sem endereço", () => {
    const semHandle = { name: "Sem endereço", handle: null }

    const abas = abasDoCatalogo(
      [raiz, semHandle],
      { ...raiz, category_children: [raiz, semHandle] }
    )

    expect(abas.map((aba) => aba.label)).toEqual(["Todas", "Vestidos"])
  })
})
