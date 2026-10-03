/**
 * O registry, na prática.
 * -------------------------------------------------------------------------
 * O que este arquivo compra é a **inversão**: o checkout deixa de perguntar o
 * TIPO do meio e passa a perguntar ao REGISTRO quem responde por este id. A
 * prova é o critério de aceite nº 7 do RV-002 — trocar `fulfillment` para
 * `inline` e implementar `render` não pode alterar uma linha de
 * `modules/checkout/`. E o que o segura no lugar é o registry resolver **sem
 * `undefined`**, para que um provedor desconhecido não vire um `?.[0]` em
 * todos os call sites.
 *
 * São funções puras sobre um mapa: teste aqui não precisa de React, de DOM nem
 * de rede — que é o motivo de o registry não importar componente nenhum além do
 * que os adapters declaram.
 */
import { describe, expect, it } from "vitest"

import { MANUAL_PROVIDER_ID, STRIPE_PROVIDER_PREFIX } from "@rv/contrato/payment"
import { paymentLabel } from "@lib/payments/labels"
import {
  __registerForTest,
  listPaymentAdapters,
  resolvePayment,
} from "@lib/payments/registry"
import type { PaymentAdapter } from "@lib/payments/types"

const fake = (patch: Partial<PaymentAdapter> = {}): PaymentAdapter => ({
  id: "pp_fake_fake",
  label: "Fake",
  icon: null,
  capabilities: { pix: false, cards: false, boleto: false, interestFree: false },
  fulfillment: "redirect",
  ...patch,
})

describe("resolvePayment", () => {
  it("resolve o meio manual do Medusa", () => {
    expect(resolvePayment(MANUAL_PROVIDER_ID).id).toBe(MANUAL_PROVIDER_ID)
  })

  it("resolve um id do Stripe pelo prefixo", () => {
    expect(resolvePayment("pp_stripe_stripe").id).toBe(STRIPE_PROVIDER_PREFIX)
  })

  it("resolve os demais meios do mesmo provedor pelo prefixo", () => {
    // O Medusa nomeia o provider `pp_<modulo>_<id>`; `pp_stripe_ideal_stripe`
    // é o MESMO provedor do `pp_stripe_stripe`, com outro meio.
    expect(resolvePayment("pp_stripe_ideal_stripe").id).toBe(
      STRIPE_PROVIDER_PREFIX
    )
  })

  describe("nunca devolve undefined", () => {
    // É o critério que impede um `provider_id` gravado por uma versão futura
    // (ou à mão) de derrubar o checkout.
    it("para um id desconhecido", () => {
      expect(resolvePayment("pp_que_nao_existe_x").id).toBe("unsupported")
    })

    it("para undefined", () => {
      expect(resolvePayment(undefined).id).toBe("unsupported")
    })

    it("para null", () => {
      expect(resolvePayment(null).id).toBe("unsupported")
    })

    it("para string vazia", () => {
      expect(resolvePayment("").id).toBe("unsupported")
    })
  })

  it("um adapter registrado responde pelo seu id exato", () => {
    const restaura = __registerForTest(fake({ id: "pp_fake_exato" }))

    expect(resolvePayment("pp_fake_exato").label).toBe("Fake")

    restaura()
    // E depois de remover, volta ao fallback — o registro não guarda rastro.
    expect(resolvePayment("pp_fake_exato").id).toBe("unsupported")
  })

  it("o manual nunca é sobreposto por prefixo de outro adapter", () => {
    // `pp_stripe_stripe` começa com `pp_stripe_`, não com o id do manual —
    // mas o teste trava a ordem: o manual é exato, os demais são por prefixo.
    expect(resolvePayment(MANUAL_PROVIDER_ID).fulfillment).toBe("external")
  })
})

describe("o registry lista o que está registrado", () => {
  it("inclui o meio manual e o fallback", () => {
    const ids = listPaymentAdapters().map((a) => a.id)

    expect(ids).toContain(MANUAL_PROVIDER_ID)
    expect(ids).toContain("unsupported")
  })

  it("devolve uma cópia — mexer na lista não muda o registro", () => {
    const antes = listPaymentAdapters().length
    listPaymentAdapters().pop()

    expect(listPaymentAdapters()).toHaveLength(antes)
  })
})

describe("fulfillment decide o caminho, não o id", () => {
  // É o mecanismo que faz Checkout Pro -> Checkout API ser uma mudança de
  // valor no adapter, e não uma mudança no checkout.
  it("o Stripe é inline (cartão na nossa página)", () => {
    expect(resolvePayment("pp_stripe_stripe").fulfillment).toBe("inline")
  })

  it("o manual é external (não há checkout)", () => {
    expect(resolvePayment(MANUAL_PROVIDER_ID).fulfillment).toBe("external")
  })

  it("um adapter redirect não traz InlineUI", () => {
    // É o que o Checkout Pro do Mercado Pago vai ser: redireciona, e não tem
    // formulário para desenhar na nossa página.
    const restaura = __registerForTest(fake({ fulfillment: "redirect" }))
    const adapter = resolvePayment("pp_fake_fake")

    expect(adapter.fulfillment).toBe("redirect")
    expect(adapter.InlineUI).toBeUndefined()

    restaura()
  })

  it("o adapter inline traz a UI do meio", () => {
    // O cartão do Stripe é `inline` e tem `InlineUI` — e o checkout nunca a
    // nomeia: ele pega do registry.
    const adapter = resolvePayment("pp_stripe_stripe")

    expect(adapter.fulfillment).toBe("inline")
    expect(adapter.InlineUI).toBeDefined()
  })
})

describe("paymentLabel — o rótulo no server component", () => {
  // O `payment-details` do pedido é server component e não pode importar o
  // registry (que puxa React e o SDK do Stripe). Este é o caminho dele.
  it("rotula o meio manual", () => {
    expect(paymentLabel(MANUAL_PROVIDER_ID).title).toBe("Pagamento manual")
  })

  it("rotula um id do Stripe pelo prefixo", () => {
    expect(paymentLabel("pp_stripe_ideal_stripe").title).toBe(
      "Cartão de crédito"
    )
  })

  it("um id desconhecido devolve o próprio id, sem quebrar", () => {
    expect(paymentLabel("pp_novo_do_futuro_x").title).toBe(
      "pp_novo_do_futuro_x"
    )
  })
})