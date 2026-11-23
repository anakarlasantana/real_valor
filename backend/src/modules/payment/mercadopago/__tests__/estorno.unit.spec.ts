import { instrucaoDeEstorno } from "../estorno"

describe("a instrução de estorno", () => {
  it("diz que o estorno é feito no painel do provedor", () => {
    const texto = instrucaoDeEstorno({ id: "987654321", transaction_amount: 189.9 })

    expect(texto).toContain("O estorno é feito no painel do Mercado Pago")
    expect(texto).toContain("Atividade → Pagamentos")
  })

  it("identifica o pagamento mascarado, e não pelo id cru", () => {
    const texto = instrucaoDeEstorno({ id: "987654321", transaction_amount: 10 })

    expect(texto).toContain("…654321")
    expect(texto).not.toContain("987654321")
  })

  it("leva o valor com duas casas", () => {
    const texto = instrucaoDeEstorno({ id: "123456789", transaction_amount: 189.9 })

    expect(texto).toContain("R$ 189.90")
  })

  it("sem pagamento, não quebra e não inventa identificação", () => {
    const texto = instrucaoDeEstorno(undefined)

    expect(texto).toContain("R$ 0.00")
    expect(texto).toContain("O estorno é feito no painel do Mercado Pago")
  })
})
