/**
 * A fronteira com o Medusa: a API cota em centavos (3150) e o carrinho recebe
 * reais (31.5). Foi aqui que o PAC saiu por R$ 3.150,00. A rede está mockada:
 * o teste mede a conversão, não a transportadora.
 */
import { SuperFreteFulfillmentService } from "../service"
import { chamarSuperFrete } from "../cliente"

jest.mock("../cliente", () => ({
  ...jest.requireActual("../cliente"),
  chamarSuperFrete: jest.fn(),
}))

const caixas = [
  {
    id: "p1",
    nome: "Caixa padrão",
    peso_gramas: 300,
    altura_cm: 10,
    largura_cm: 20,
    comprimento_cm: 30,
    padrao: true,
    ativo: true,
  },
]

const provedor = () =>
  new SuperFreteFulfillmentService({
    logger: { info: () => undefined, warn: () => undefined },
    manager: { execute: async () => caixas },
  })

/** O contexto do Medusa: origem, destino e as peças do carrinho. */
const contexto = (quantidade = 1, cep = "60352680") =>
  ({
    from_location: { address: { postal_code: "01310100" } },
    shipping_address: { postal_code: cep },
    items: [{ quantity: quantidade, variant: { weight: 300 } }],
  }) as any

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)

describe("SuperFreteFulfillmentService.calculatePrice", () => {
  beforeEach(() => {
    ;(chamarSuperFrete as jest.Mock).mockReset()
    // A resposta crua do `POST /api/v0/calculator`: preço em reais, código 1 = PAC.
    ;(chamarSuperFrete as jest.Mock).mockResolvedValue([
      { id: 1, name: "PAC", price: 31.5, delivery_time: 2 },
    ])
  })

  it("entrega em reais o que a API cotou em centavos", async () => {
    const preco = await provedor().calculatePrice({ servico: "PAC" }, {}, contexto())

    expect(preco.calculated_amount).toBe(31.5)
    expect(preco.is_calculated_price_tax_inclusive).toBe(false)
    expect(formatar(preco.calculated_amount)).toContain("31,50")
  })

  it("cobra a quantidade de caixas sem perder a unidade", async () => {
    // 3 caixas × 3150 = 94.5, nunca 9450. O CEP é outro de propósito: a L1
    // guarda a cotação de 1 caixa e a devolve sem multiplicar (outro trabalho).
    const preco = await provedor().calculatePrice(
      { servico: "PAC" },
      {},
      contexto(3, "60352681")
    )

    expect(preco.calculated_amount).toBe(94.5)
    expect(formatar(preco.calculated_amount)).toContain("94,50")
  })

  it("não aceita serviço que a opção não declara", async () => {
    await expect(
      provedor().calculatePrice({}, {}, contexto())
    ).rejects.toThrow()
  })
})
