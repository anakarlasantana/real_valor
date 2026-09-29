/**
 * Quando o formulário de uma seção tem alteração para salvar.
 *
 * É o que decide se a barra com o botão **Salvar** aparece — então o que estes
 * testes travam é justamente o que uma comparação ingênua erraria: número contra
 * texto (`8` e `"8"` são a mesma ordem digitada) e campo ausente contra campo
 * vazio (o contrato marca `null`/`undefined`/`""` como "segue o tema da loja").
 */
import { fingerprint, isDirty, wireValue } from "../form-draft"

describe("fingerprint", () => {
  it("trata ausente, nulo e vazio como a mesma coisa", () => {
    expect(fingerprint(undefined)).toBe("")
    expect(fingerprint(null)).toBe("")
    expect(fingerprint("")).toBe("")
  })

  it("não distingue número de texto", () => {
    expect(fingerprint(8)).toBe(fingerprint("8"))
    expect(fingerprint(0)).toBe(fingerprint("0"))
  })

  it("distingue listas e objetos por conteúdo", () => {
    expect(fingerprint(["Conjuntos", "Vestidos"])).not.toBe(
      fingerprint(["Vestidos", "Conjuntos"])
    )
    expect(fingerprint({ imageUrl: "a.png" })).toBe(
      fingerprint({ imageUrl: "a.png" })
    )
  })
})

describe("isDirty", () => {
  const gravada = {
    id: "hero",
    type: "hero",
    enabled: true,
    position: 100,
    headline: "A alfaiataria",
  }

  it("uma seção intocada não está alterada", () => {
    expect(isDirty({ ...gravada }, gravada)).toBe(false)
  })

  it("o mesmo valor em outro tipo (número/texto) não é alteração", () => {
    expect(isDirty({ ...gravada, position: "100" }, gravada)).toBe(false)
  })

  it("campo novo vazio não é alteração", () => {
    expect(isDirty({ ...gravada, seloNovo: "" }, gravada)).toBe(false)
  })

  it("texto diferente é alteração", () => {
    expect(isDirty({ ...gravada, headline: "Outro título" }, gravada)).toBe(true)
  })

  it("visibilidade diferente é alteração", () => {
    expect(isDirty({ ...gravada, enabled: false }, gravada)).toBe(true)
  })

  it("lista reordenada é alteração", () => {
    expect(
      isDirty({ ...gravada, items: ["b", "a"] }, { ...gravada, items: ["a", "b"] })
    ).toBe(true)
  })
})

/**
 * O valor da tela virando o valor da API.
 *
 * Um campo de **referência** (os chips de categoria) é um objeto na tela — o
 * chip precisa do nome para ser desenhado — e uma lista de ids no corpo: o que
 * se grava é a referência, e o rótulo é leitura da loja. Sem esta conversão o
 * corpo levaria `{ categoryId, label, handle }` e a rota recusaria ("deve ser
 * uma lista de ids de categoria"), que é a resposta certa por um motivo que o
 * lojista não tem como consertar pela tela.
 */
describe("wireValue", () => {
  const chips = [
    { categoryId: "pcat_a", label: "Vestidos", handle: "vestidos" },
    { categoryId: "pcat_b", label: "Conjuntos", handle: "conjuntos" },
  ]

  it("o campo de referência vira a lista de ids, na ordem da tela", () => {
    expect(wireValue("list:category", chips)).toEqual(["pcat_a", "pcat_b"])
  })

  it("todo o resto do formulário vai como está", () => {
    expect(wireValue("text", "Peças em destaque")).toBe("Peças em destaque")
    expect(wireValue("list:text", ["a", "b"])).toEqual(["a", "b"])
    expect(wireValue("image", "foto.jpg")).toBe("foto.jpg")
  })

  it("vazio é vazio: a API lê `[]` como \"esvazia os chips\"", () => {
    expect(wireValue("list:category", [])).toEqual([])
    expect(wireValue("list:category", undefined)).toBeUndefined()
  })
})
