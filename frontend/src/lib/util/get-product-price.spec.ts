/**
 * O preço que a loja mostra: formato, oferta e o preço zero.
 * -------------------------------------------------------------------------
 * Três defeitos moram aqui, e os três são silenciosos:
 *
 *   1. **`R$ 249.90`.** O `convertToLocale` tinha `locale = "en-US"` (herança do
 *      starter) e formatava **todo** dinheiro da loja com ponto decimal. Nenhum
 *      teste olhava a string formatada, então passou por todas as suítes;
 *   2. **peça sem preço que o checkout vende.** A guarda tratava
 *      `calculated_amount === 0` como ausência: a vitrine mostrava a peça sem
 *      preço e o carrinho fechava por R$ 0,00;
 *   3. **`-NaN%`.** Sem `original_amount`, a conta do desconto dava `NaN` e ele
 *      ia para a tela.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import { getPricesForVariant, getProductPrice } from "./get-product-price"
import { convertToLocale } from "./money"

/** Uma variante como a Store API a devolve nesses campos. */
const variante = ({
  calculado,
  original,
  lista = "default",
  id = "var_1",
}: {
  calculado: number
  original: number
  lista?: string
  id?: string
}) => ({
  id,
  calculated_price: {
    calculated_amount: calculado,
    original_amount: original,
    currency_code: "brl",
    calculated_price: { price_list_type: lista },
  },
})

const produto = (variants: unknown[]) =>
  ({ id: "prod_1", variants }) as never

describe("convertToLocale", () => {
  it("formata em pt-BR: vírgula decimal, e não ponto", () => {
    // O defeito que este arquivo existe para travar: `R$249.90` na vitrine.
    expect(convertToLocale({ amount: 249.9, currency_code: "brl" })).toMatch(
      /249,90/
    )
  })

  it("sem código de moeda, devolve o número cru", () => {
    expect(convertToLocale({ amount: 10, currency_code: "" })).toBe("10")
  })
})

describe("getPricesForVariant", () => {
  it("em oferta, marca o tipo e calcula a queda", () => {
    const preco = getPricesForVariant(variante({ calculado: 24990, original: 39900, lista: "sale" }))!

    expect(preco.price_type).toBe("sale")
    expect(preco.calculated_price_number).toBe(24990)
    expect(preco.original_price_number).toBe(39900)
    expect(preco.percentage_diff).toBe("37")
  })

  it("PREÇO ZERO é preço, e não ausência", () => {
    const preco = getPricesForVariant(variante({ calculado: 0, original: 0 }))

    expect(preco).not.toBeNull()
    expect(preco!.calculated_price_number).toBe(0)
    expect(preco!.calculated_price).toMatch(/0,00/)
    // Sem preço cheio não há queda a anunciar — e "-NaN%" não pode existir.
    expect(preco!.percentage_diff).toBe("0")
  })

  it("sem bloco de preço calculado, é ausência", () => {
    expect(getPricesForVariant({ id: "var_1" })).toBeNull()
    expect(getPricesForVariant(null)).toBeNull()
  })
})

describe("getProductPrice", () => {
  it("escolhe a variante mais barata e ignora quem não tem preço", () => {
    const { cheapestPrice } = getProductPrice({
      product: produto([
        variante({ calculado: 39900, original: 39900 }),
        { id: "var_sem_preco" },
        variante({ calculado: 19900, original: 19900 }),
      ]),
    })

    expect(cheapestPrice!.calculated_price_number).toBe(19900)
  })

  it("produto sem variante não tem preço — e não lança", () => {
    expect(getProductPrice({ product: produto([]) }).cheapestPrice).toBeNull()
  })

  it("com o id da variante escolhida, o preço é o dela", () => {
    const { variantPrice } = getProductPrice({
      product: produto([
        variante({ calculado: 19900, original: 19900, id: "var_barata" }),
        variante({ calculado: 39900, original: 39900, id: "var_cara" }),
      ]),
      variantId: "var_cara",
    })

    expect(variantPrice!.calculated_price_number).toBe(39900)
  })
})
