/**
 * Quando o formulário de uma seção tem alteração para salvar.
 *
 * É o que decide se a barra com o botão **Salvar** aparece — então o que estes
 * testes travam é justamente o que uma comparação ingênua erraria: número contra
 * texto (`8` e `"8"` são a mesma ordem digitada) e campo ausente contra campo
 * vazio (o contrato marca `null`/`undefined`/`""` como "segue o tema da loja").
 */
import { fingerprint, isDirty } from "../form-draft"

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
    expect(fingerprint(["Blazers", "Vestidos"])).not.toBe(
      fingerprint(["Vestidos", "Blazers"])
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
