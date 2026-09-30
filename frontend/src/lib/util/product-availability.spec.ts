/**
 * O estado de uma peça: o chip do card e o botão da página do produto.
 * -------------------------------------------------------------------------
 * O que este teste protege é a **precedência** e a simetria com o estoque:
 *
 *   - um rótulo que a loja conhece vence o estoque, e um que ela não conhece não
 *     vira chip vazio — cai para o que o estoque diz;
 *   - "Pronta Entrega" escrito à mão (o valor que o catálogo real já tem em
 *     `metadata.tag_status`) precisa aparecer no card, e não ser engolido pela
 *     derivação;
 *   - o estado derivado tem de bater com `variantIsAvailable`: um produto com
 *     estoque zerado e sem encomenda é "esgotado", e o botão da página concorda
 *     (se as duas contas divergirem, o card promete o que o botão recusa);
 *   - "últimas" é o limiar, e limiar errado é o chip que nunca aparece — ou o
 *     que aparece em todo produto.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import {
  LAST_UNITS_THRESHOLD,
  normalizeStatusLabel,
  productStatus,
  PRODUCT_STATUS_LABELS,
  statusFromLabel,
  variantIsAvailable,
  type ProductStatus,
} from "./product-availability"

/** Um variant controlado, com estoque — a forma do catálogo real. */
const stocked = (quantity: number) => ({
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: quantity,
})

describe("productStatus — o que o lojista escreve vence", () => {
  it("`metadata.tag_status` é lido (o valor que o catálogo real tem)", () => {
    expect(productStatus({ metadata: { tag_status: "Pronta Entrega" } })).toBe(
      "pronta-entrega"
    )
  })

  it("acento, caixa e separador não mudam o estado", () => {
    const variants = [stocked(250)]

    expect(
      productStatus({ metadata: { tag_status: "PRONTA_ENTREGA" }, variants })
    ).toBe("pronta-entrega")
    expect(
      productStatus({ metadata: { tag_status: "  últimas  " }, variants })
    ).toBe("ultimas")
    expect(
      productStatus({ metadata: { tag_status: "sob-encomenda" }, variants })
    ).toBe("sob-demanda")
  })

  it("palavra do lojista vence o estoque zerado (o chip é aviso, não trava)", () => {
    expect(
      productStatus({
        metadata: { tag_status: "Pronta Entrega" },
        variants: [stocked(0)],
      })
    ).toBe("pronta-entrega")
  })

  it("rótulo fora da tabela cai no estoque (e não inventa estado)", () => {
    expect(
      productStatus({
        metadata: { tag_status: "Feito à mão" },
        variants: [stocked(250)],
      })
    ).toBe("pronta-entrega")
    expect(
      productStatus({
        metadata: { tag_status: "Feito à mão" },
        variants: [stocked(0)],
      })
    ).toBe("esgotado")
  })

  it("sem `tag_status`, vale a tag do produto", () => {
    expect(
      productStatus({
        tags: [{ value: "Sob demanda" }],
        variants: [stocked(250)],
      })
    ).toBe("sob-demanda")
  })

  it("a primeira tag reconhecida é a que vale", () => {
    expect(
      productStatus({
        tags: [{ value: "verão" }, { value: "Esgotado" }, { value: "últimas" }],
      })
    ).toBe("esgotado")
  })

  it("tag sem valor (o catálogo tem tag vazia) não quebra nem inventa", () => {
    expect(
      productStatus({ tags: [null, {}, { value: "" }], variants: [stocked(9)] })
    ).toBe("pronta-entrega")
  })
})

describe("productStatus — o que o estoque diz", () => {
  it("estoque folgado é pronta entrega", () => {
    expect(productStatus({ variants: [stocked(250)] })).toBe("pronta-entrega")
  })

  it("poucas peças é últimas, e o limiar está onde o chip diz", () => {
    expect(productStatus({ variants: [stocked(LAST_UNITS_THRESHOLD)] })).toBe(
      "ultimas"
    )
    expect(productStatus({ variants: [stocked(LAST_UNITS_THRESHOLD + 1)] })).toBe(
      "pronta-entrega"
    )
  })

  it("o estoque é somado entre os variants compráveis", () => {
    expect(productStatus({ variants: [stocked(2), stocked(2)] })).toBe(
      "pronta-entrega"
    )
    expect(productStatus({ variants: [stocked(2), stocked(1)] })).toBe("ultimas")
  })

  it("estoque zerado com encomenda aceita é sob demanda", () => {
    expect(
      productStatus({
        variants: [
          {
            manage_inventory: true,
            allow_backorder: true,
            inventory_quantity: 0,
          },
        ],
      })
    ).toBe("sob-demanda")
  })

  it("estoque zerado sem encomenda é esgotado", () => {
    expect(productStatus({ variants: [stocked(0)] })).toBe("esgotado")
  })

  it("sem controle de estoque é pronta entrega (não há o que contar)", () => {
    expect(productStatus({ variants: [{ manage_inventory: false }] })).toBe(
      "pronta-entrega"
    )
  })

  it("produto sem variant nenhum é esgotado (não há o que comprar)", () => {
    expect(productStatus({})).toBe("esgotado")
    expect(productStatus({ variants: [] })).toBe("esgotado")
  })
})

describe("variantIsAvailable — a mesma regra do botão da página", () => {
  it("sem controle de estoque: compra", () => {
    expect(variantIsAvailable({ manage_inventory: false })).toBe(true)
  })

  it("com encomenda aceita: compra, mesmo com estoque zerado", () => {
    expect(
      variantIsAvailable({ manage_inventory: true, allow_backorder: true })
    ).toBe(true)
  })

  it("com estoque: compra", () => {
    expect(variantIsAvailable(stocked(1))).toBe(true)
  })

  it("com estoque zerado e sem encomenda: não compra", () => {
    expect(variantIsAvailable(stocked(0))).toBe(false)
  })

  it("variant ausente: não compra (nada selecionado ainda)", () => {
    expect(variantIsAvailable(undefined)).toBe(false)
    expect(variantIsAvailable(null)).toBe(false)
  })

  it("estoque ausente conta como zero, e não como NaN", () => {
    expect(
      variantIsAvailable({ manage_inventory: true, allow_backorder: false })
    ).toBe(false)
  })
})

describe("rótulos", () => {
  it("todo estado tem rótulo na loja", () => {
    const statuses: ProductStatus[] = [
      "pronta-entrega",
      "sob-demanda",
      "ultimas",
      "esgotado",
    ]

    for (const status of statuses) {
      expect(PRODUCT_STATUS_LABELS[status]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it("a normalização é a mesma para as três escritas do mesmo rótulo", () => {
    expect(normalizeStatusLabel("Pronta-Entrega")).toBe("pronta entrega")
    expect(normalizeStatusLabel("  PRONTA   ENTREGA ")).toBe("pronta entrega")
    expect(normalizeStatusLabel("Pronta_Entrega")).toBe("pronta entrega")
  })

  it("valor que não é texto não vira estado", () => {
    expect(statusFromLabel(42)).toBeUndefined()
    expect(statusFromLabel(null)).toBeUndefined()
    expect(statusFromLabel("")).toBeUndefined()
  })
})
