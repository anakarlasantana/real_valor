/** O que este teste prende: entrega e cobrança formatam o CEP e o telefone igual. */
import { describe, expect, it } from "vitest"

import { mascararCampoDeEndereco } from "../mascaras-de-endereco"

describe("mascararCampoDeEndereco — CEP", () => {
  it("formata o CEP da entrega e o da cobrança do mesmo jeito", () => {
    for (const campo of [
      "shipping_address.postal_code",
      "billing_address.postal_code",
    ]) {
      expect(mascararCampoDeEndereco(campo, "01310100")).toBe("01310-100")
    }
  })

  it("formata enquanto cresce, sem traço solto", () => {
    expect(
      mascararCampoDeEndereco("shipping_address.postal_code", "0131")
    ).toBe("0131")
    expect(
      mascararCampoDeEndereco("shipping_address.postal_code", "013101")
    ).toBe("01310-1")
  })
})

describe("mascararCampoDeEndereco — telefone", () => {
  it("formata o telefone da entrega e o da cobrança do mesmo jeito", () => {
    for (const campo of ["shipping_address.phone", "billing_address.phone"]) {
      expect(mascararCampoDeEndereco(campo, "11912345678")).toBe(
        "(11) 91234-5678"
      )
    }
  })

  it("monta o fixo com oito números", () => {
    expect(
      mascararCampoDeEndereco("shipping_address.phone", "1134567890")
    ).toBe("(11) 3456-7890")
  })
})

describe("mascararCampoDeEndereco — o que não tem máscara", () => {
  it("devolve undefined para nome, endereço e cidade — o campo usa o valor cru", () => {
    for (const campo of [
      "shipping_address.first_name",
      "shipping_address.address_1",
      "shipping_address.city",
      "billing_address.province",
      "email",
    ]) {
      expect(mascararCampoDeEndereco(campo, "Avenida Paulista, 1578")).toBe(
        undefined
      )
    }
  })
})
