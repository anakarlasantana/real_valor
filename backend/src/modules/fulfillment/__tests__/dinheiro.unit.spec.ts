/**
 * Centavos viram reais na fronteira: 3150 sem conversão é R$ 3.150,00 na tela.
 */
import { emCentavos, emReais } from "../dinheiro"

/** O mesmo formato da vitrine (`convertToLocale`, `pt-BR` + `BRL`). */
const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)

describe("emReais", () => {
  it("converte centavos no decimal que o Medusa guarda", () => {
    expect(emReais(3150)).toBe(31.5)
    expect(emReais(6473)).toBe(64.73)
    expect(emReais(1690)).toBe(16.9)
  })

  it("não deixa sobra de float na coluna numérica", () => {
    expect(emReais(2990)).toBe(29.9)
    expect(emReais(100)).toBe(1)
    expect(emReais(10)).toBe(0.1)
    expect(emReais(0)).toBe(0)
  })

  it("é a diferença entre R$ 31,50 e R$ 3.150,00 na tela", () => {
    expect(formatar(emReais(3150))).toContain("31,50")
    expect(formatar(3150)).toContain("3.150,00")
  })

  it("é o caminho de volta para a etiqueta", () => {
    // O declarado na etiqueta sai de `unit_price` (decimal): 249.9 → 24990.
    expect(emCentavos(249.9)).toBe(24990)
    expect(emCentavos(129.9)).toBe(12990)
    expect(emCentavos(0)).toBe(0)
  })

  it("aguenta valor inválido sem virar NaN no carrinho", () => {
    expect(emReais(Number.NaN)).toBe(0)
  })
})
