/**
 * O documento da preferência — o que sai daqui vai para o Mercado Pago.
 * -------------------------------------------------------------------------
 * Um documento que só se sabe estar errado quando a cliente **não consegue
 * pagar**: um campo obrigatório faltando vira 400 do provedor e uma tela em
 * branco, e um valor na unidade errada vira uma cobrança de cem vezes o preço
 * que **funciona** — o checkout completa e a loja descobre depois.
 *
 * Por isso a preferência é uma função pura, e por isso ela é conferida aqui.
 */
import {
  MERCADOPAGO_CARTAO_PROVIDER_ID,
  MERCADOPAGO_PIX_PROVIDER_ID,
} from "@rv/contrato/payment"

import {
  METODOS,
  TODOS_OS_METODOS,
  construirPreferencia,
  emReais,
  metodoDoProviderId,
} from "../preferencia"

const BASE = {
  sessionId: "payses_01HQ8Z9K2M4N6P8R0T2V4X6Z8A",
  centavos: 18990,
  metodo: "pix" as const,
  descricao: "Real Valor — pedido",
  urlNotificacao: "https://loja.exemplo/webhooks/mercadopago/pix",
  backUrls: {
    success: "https://loja.exemplo/confirmacao",
    pending: "https://loja.exemplo/confirmacao",
    failure: "https://loja.exemplo/confirmacao",
  },
}

describe("a conversão de centavos para reais", () => {
  it("divide por cem — o erro mais caro do módulo", () => {
    // ⚠️ O Medusa trabalha em centavos e o Mercado Pago em reais decimais. Sem
    // esta divisão, R$ 189,90 vira R$ 18.990,00 e o checkout **funciona**.
    expect(emReais(18990)).toBe(189.9)
    expect(emReais(100)).toBe(1)
    expect(emReais(1)).toBe(0.01)
    expect(emReais(0)).toBe(0)
  })

  it("não deixa o ponto flutuante chegar no payload", () => {
    // `189.9 * 100` não dá exatamente 18990 em binário. A ida e a volta têm de
    // ser estáveis, senão a comparação de valores do webhook acusa divergência
    // num pagamento correto.
    for (const centavos of [18990, 123457, 999, 7000, 3333, 1]) {
      expect(Math.round(emReais(centavos) * 100)).toBe(centavos)
    }
  })
})

describe("o builder da preferência", () => {
  it("usa o id da sessão como `external_reference` — a chave de volta", () => {
    // É o único campo que o webhook devolve. Sem ele, um pagamento aprovado não
    // tem como ser ligado a um carrinho.
    const p = construirPreferencia(BASE)

    expect(p.external_reference).toBe(BASE.sessionId)
    expect((p.items as { id: string }[])[0].id).toBe(BASE.sessionId)
  })

  it("manda o valor em reais e a moeda certa", () => {
    const item = (construirPreferencia(BASE).items as Record<string, unknown>[])[0]

    expect(item.unit_price).toBe(189.9)
    expect(item.currency_id).toBe("BRL")
    expect(item.quantity).toBe(1)
  })

  it("as três `back_urls` vêm juntas — e `auto_return` só com elas", () => {
    const comUrls = construirPreferencia(BASE)

    expect(comUrls.back_urls).toEqual(BASE.backUrls)
    expect(comUrls.auto_return).toBe("approved")

    // Sem `back_urls`, `auto_return` sozinho é um 400 do provedor, e não um
    // campo ignorado. Ele tem de sumir junto.
    const semUrls = construirPreferencia({ ...BASE, backUrls: undefined })

    expect(semUrls.back_urls).toBeUndefined()
    expect(semUrls.auto_return).toBeUndefined()
  })

  it("só manda `notification_url` quando ela existe", () => {
    expect(construirPreferencia(BASE).notification_url).toBe(BASE.urlNotificacao)
    expect(
      construirPreferencia({ ...BASE, urlNotificacao: "" }).notification_url
    ).toBeUndefined()
  })

  it("exclui os meios do outro checkout, para a cliente não sair da trilha", () => {
    const pix = construirPreferencia({ ...BASE, metodo: "pix" })
      .payment_methods as Record<string, unknown>
    const cartao = construirPreferencia({ ...BASE, metodo: "cartao" })
      .payment_methods as Record<string, unknown>

    const ids = (v: unknown) => (v as { id: string }[]).map((x) => x.id)

    // Pix exclui cartão e boleto; cartão exclui o Pix (`bank_transfer`).
    expect(ids(pix.excluded_payment_types)).toContain("credit_card")
    expect(ids(pix.excluded_payment_types)).toContain("ticket")
    expect(ids(cartao.excluded_payment_types)).toContain("bank_transfer")
    expect(ids(cartao.excluded_payment_types)).not.toContain("credit_card")

    expect(cartao.installments).toBe(12)
    expect(pix.installments).toBe(1)
  })

  it("NÃO manda `binary_mode` — ele mataria o Pix", () => {
    // `binary_mode` faz o provedor responder só aprovado/recusado, sem
    // "pendente" — e o Pix **é** pendente por natureza. Ligá-lo quebraria o
    // meio que a loja mais quer, e o sintoma seria "o Pix nunca confirma".
    expect(construirPreferencia(BASE).binary_mode).toBeUndefined()
  })

  it("não expira por padrão, e expira quando pedido", () => {
    // Ausente é o padrão seguro: um formato de data que o provedor recuse
    // derruba a preferência inteira, e é a única validação daqui que não se pode
    // conferir offline.
    expect(construirPreferencia(BASE).expires).toBeUndefined()

    const comPrazo = construirPreferencia({
      ...BASE,
      expiracaoMinutos: 30,
      agora: new Date("2026-10-05T12:00:00.000Z"),
    })

    expect(comPrazo.expires).toBe(true)
    expect(comPrazo.expiration_date_from).toBe("2026-10-05T12:00:00.000Z")
    expect(comPrazo.expiration_date_to).toBe("2026-10-05T12:30:00.000Z")
  })

  it("não repassa campo que não foi escolhido", () => {
    // A forma é fechada de propósito: nada de `...input`. Um campo a mais vindo
    // do Medusa não pode virar escrita no provedor sem alguém decidir.
    const p = construirPreferencia({
      ...BASE,
      payer: { email: "vazamento@exemplo.com" },
      metadata: { qualquer: "coisa" },
    } as never)

    expect(p).not.toHaveProperty("payer")
    expect(p).not.toHaveProperty("metadata")
  })
})

describe("o método pelo `provider_id`", () => {
  it("reconhece os dois do contrato", () => {
    expect(metodoDoProviderId(MERCADOPAGO_PIX_PROVIDER_ID)).toBe("pix")
    expect(metodoDoProviderId(MERCADOPAGO_CARTAO_PROVIDER_ID)).toBe("cartao")
  })

  it("devolve undefined para o que não é nosso — inclusive o `pp_system_default`", () => {
    // A distinção importa: "não é Mercado Pago" é um caso de borda legítimo; "é
    // Mercado Pago e eu não reconheci" seria um bug de registro.
    expect(metodoDoProviderId("pp_system_default")).toBeUndefined()
    expect(metodoDoProviderId("pp_stripe_main")).toBeUndefined()
    expect(metodoDoProviderId(undefined)).toBeUndefined()
    expect(metodoDoProviderId("")).toBeUndefined()
  })

  it("os dois `providerId` e os dois rótulos estão definidos", () => {
    expect(TODOS_OS_METODOS).toEqual(["pix", "cartao"])

    for (const m of TODOS_OS_METODOS) {
      expect(METODOS[m].providerId).toBeTruthy()
      expect(METODOS[m].rotulo).toBeTruthy()
      expect(METODOS[m].excluidos.length).toBeGreaterThan(0)
    }
  })
})
