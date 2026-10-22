/**
 * O que sai do provider, no formato em que a vitrine formata. A regra da tabela
 * já é testada em `tabela.unit.spec.ts`; aqui o que se mede é a **unidade** —
 * foi por ela que o PAC de R$ 16,90 apareceu por R$ 1.690,00.
 */
import TabelaFulfillmentService from "../service"

const servico = new TabelaFulfillmentService({
  logger: { info: () => undefined, warn: () => undefined },
})

const contexto = (cep: string, peso: number, quantidade = 1) =>
  ({
    shipping_address: { postal_code: cep },
    items: [{ quantity: quantidade, variant: { weight: peso } }],
  }) as any

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)

describe("TabelaFulfillmentService.calculatePrice", () => {
  it("entrega o preço no decimal do Medusa, não em centavos", async () => {
    // A tabela diz 1690 centavos para SP · 300g.
    const preco = await servico.calculatePrice(
      { region: "sudeste" },
      {},
      contexto("01310100", 300)
    )

    expect(preco.calculated_amount).toBe(16.9)
    expect(preco.is_calculated_price_tax_inclusive).toBe(false)
    expect(formatar(preco.calculated_amount)).toContain("16,90")
  })

  it("multiplica a quantidade sem perder a unidade", async () => {
    // 3 peças de 300g = 900g → faixa "Até 1kg" → 2190 centavos → R$ 21,90.
    const preco = await servico.calculatePrice(
      { region: "sudeste" },
      {},
      contexto("01310100", 300, 3)
    )

    expect(preco.calculated_amount).toBe(21.9)
    expect(formatar(preco.calculated_amount)).toContain("21,90")
  })

  it("continua recusando destino que a tabela não cobre", async () => {
    await expect(
      servico.calculatePrice({ region: "sudeste" }, {}, contexto("", 300))
    ).rejects.toThrow()
  })
})
