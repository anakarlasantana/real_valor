/**
 * O filtro do meio manual e a ordem da lista. O `pp_system_default` não pode
 * chegar ao checkout (o Admin não o desliga); os meios reais seguem na ordem.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
import { describe, expect, it } from "vitest"

import {
  MEIO_MANUAL_DO_MEDUSA,
  meiosDePagamentoVisiveis,
} from "../providers"

const provedor = (id: string) => ({ id })

describe("meiosDePagamentoVisiveis", () => {
  it("remove o meio manual do Medusa", () => {
    const lista = meiosDePagamentoVisiveis([
      provedor("pp_mercadopago_pix"),
      provedor(MEIO_MANUAL_DO_MEDUSA),
      provedor("pp_mercadopago_cartao"),
    ])

    expect(lista.map((p) => p.id)).toEqual([
      "pp_mercadopago_cartao",
      "pp_mercadopago_pix",
    ])
  })

  it("não remove um id que só começa parecido", () => {
    const lista = meiosDePagamentoVisiveis([
      provedor("pp_system_default_v2"),
      provedor(MEIO_MANUAL_DO_MEDUSA),
    ])

    expect(lista.map((p) => p.id)).toEqual(["pp_system_default_v2"])
  })

  it("devolve lista vazia quando só existe o meio manual", () => {
    expect(meiosDePagamentoVisiveis([provedor(MEIO_MANUAL_DO_MEDUSA)])).toEqual(
      []
    )
  })

  it("ordena por id sem alterar o resto do provedor", () => {
    const pix = { id: "pp_mercadopago_pix", extra: "pix" }
    const cartao = { id: "pp_mercadopago_cartao", extra: "cartao" }

    expect(meiosDePagamentoVisiveis([pix, cartao])).toEqual([cartao, pix])
  })
})
