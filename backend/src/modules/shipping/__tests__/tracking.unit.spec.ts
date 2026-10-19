/**
 * A regra do registro de envio.
 * -------------------------------------------------------------------------
 * São funções puras sobre texto — o que significa que o teste pega o que
 * importa aqui: **um código mal colado não pode virar um link que leva a
 * cliente para a transportadora errada**, e um código sem transportadora não
 * pode sumir silenciosamente.
 *
 * O teste do `metadata` confere a coisa mais fácil de quebrar sem ninguém
 * perceber: o `metadata` do pedido também guarda o CPF que a rota de rastreio
 * usa para validar a identidade. Se a gravação regravar o objeto inteiro, o CPF
 * some e a consulta passa a dar 403 para a própria cliente.
 */
import {
  buildShippingMetadata,
  guessTrackingUrl,
  rastreioPublico,
  shippingSummary,
  situacaoDoPedido,
  validateShippingUpdate,
  DEFAULT_STATUS_LABEL,
} from "../tracking"

describe("validateShippingUpdate", () => {
  it("aceita um registro completo e válido", () => {
    expect(
      validateShippingUpdate({
        carrier: "Correios",
        trackingNumber: "BR123456789BR",
      })
    ).toBeNull()
  })

  it("aceita um registro vazio — um pedido sem código é legítimo", () => {
    expect(validateShippingUpdate({})).toBeNull()
  })

  it("recusa um código curto demais", () => {
    const erro = validateShippingUpdate({
      carrier: "Correios",
      trackingNumber: "ABC",
    })
    expect(erro).toContain("curto demais")
  })

  it("recusa caracteres inválidos no código (espaço, barra)", () => {
    for (const codigo of ["BR 123456789", "BR/123456", "BR#123456789BR"]) {
      expect(
        validateShippingUpdate({
          carrier: "Correios",
          trackingNumber: codigo,
        })
      ).toContain("caracteres inválidos")
    }
  })

  it("recusa um código sem transportadora", () => {
    // O link sai errado, e a cliente fica sem para onde clicar.
    const erro = validateShippingUpdate({ trackingNumber: "BR123456789BR" })
    expect(erro).toContain("transportadora")
  })

  it("recusa um link sem esquema", () => {
    const erro = validateShippingUpdate({
      carrier: "Correios",
      trackingNumber: "BR123456789BR",
      trackingUrl: "correios.com.br",
    })
    expect(erro).toContain("http")
  })

  it("aceita http e https", () => {
    for (const url of ["http://exemplo.com/r", "https://exemplo.com/r"]) {
      expect(
        validateShippingUpdate({
          carrier: "Correios",
          trackingNumber: "BR123456789BR",
          trackingUrl: url,
        })
      ).toBeNull()
    }
  })

  it("recusa textos longos demais", () => {
    // Cada um com a sua própria mensagem: são as duas coisas que aparecem
    // na tela quando o campo é grande demais, e confiro que cada uma é dita.
    expect(validateShippingUpdate({ carrier: "a".repeat(81) })).toContain(
      "transportadora está longo demais"
    )
    expect(validateShippingUpdate({ statusLabel: "b".repeat(61) })).toContain(
      "situação do pedido está longa demais"
    )
  })
})
describe("guessTrackingUrl", () => {
  it("reconhece o formato dos Correios", () => {
    const url = guessTrackingUrl("Correios", "BR123456789BR")
    expect(url).toContain("correios.com.br")
    expect(url).toContain("BR123456789BR")
  })

  it("aceita o formato dos Correios em minúsculas", () => {
    expect(guessTrackingUrl("Correios", "br123456789br")).toContain(
      "correios.com.br"
    )
  })

  it("reconhece o formato do Jadlog com e sem hífen", () => {
    expect(guessTrackingUrl("Jadlog", "12-345678901234")).toContain(
      "jadlog.com.br"
    )
    expect(guessTrackingUrl("Jadlog", "12345678901234")).toContain(
      "jadlog.com.br"
    )
  })

  it("devolve null para um formato desconhecido", () => {
    // Preferimos o link que o lojista digitou a um link inventado.
    expect(guessTrackingUrl("Transportadora X", "CODIGO-QUALQUER-1")).toBeNull()
  })

  it("devolve null para código vazio", () => {
    expect(guessTrackingUrl("Correios", "")).toBeNull()
  })
})

describe("buildShippingMetadata", () => {
  it("grava os quatro campos que a rota de rastreio lê", () => {
    const meta = buildShippingMetadata(null, {
      carrier: "Correios",
      trackingNumber: "BR123456789BR",
    })

    // Estes são exatamente os nomes que `orders/track/route.ts` devolve.
    expect(meta.tracking_number).toBe("BR123456789BR")
    expect(meta.carrier).toBe("Correios")
    expect(meta.tracking_url).toContain("correios.com.br")
    expect(meta.status_label).toBe(DEFAULT_STATUS_LABEL)
  })

  it("PRESERVA o que já estava no metadata e não é de envio", () => {
    // O CPF é o que a rota de rastreio usa para validar a identidade (403).
    // Perder ele aqui faria a própria cliente ser recusada na consulta.
    const anterior = {
      cpf: "12345678900",
      outro_registro: "não mexer",
    }

    const meta = {
      ...anterior,
      ...buildShippingMetadata(anterior, {
        carrier: "Correios",
        trackingNumber: "BR123456789BR",
      }),
    }

    expect(meta.cpf).toBe("12345678900")
    expect(meta.outro_registro).toBe("não mexer")
  })

  it("usa o link digitado em vez do deduzido", () => {
    const meu = "https://minha-transportadora.com.br/abc"
    const meta = buildShippingMetadata(null, {
      carrier: "Minha Transportadora",
      trackingNumber: "BR123456789BR",
      trackingUrl: meu,
    })

    expect(meta.tracking_url).toBe(meu)
  })

  it("limpa os espaços que o lojista colou", () => {
    const meta = buildShippingMetadata(null, {
      carrier: "  Correios  ",
      trackingNumber: "  BR123456789BR  ",
    })

    expect(meta.carrier).toBe("Correios")
    expect(meta.tracking_number).toBe("BR123456789BR")
  })

  it("um pedido sem código ainda tem situação", () => {
    const meta = buildShippingMetadata(null, {})

    expect(meta.tracking_number).toBe("")
    expect(meta.status_label).toBe(DEFAULT_STATUS_LABEL)
  })

  it("atualizar só a situação não apaga o código", () => {
    const anterior = { carrier: "Correios", tracking_number: "BR123456789BR" }
    const meta = buildShippingMetadata(anterior, { statusLabel: "Entregue" })

    expect(meta.status_label).toBe("Entregue")
    expect(meta.tracking_number).toBe("BR123456789BR")
    expect(meta.carrier).toBe("Correios")
  })
})

describe("shippingSummary", () => {
  it("diz que um pedido com código foi enviado", () => {
    const s = shippingSummary({
      carrier: "Correios",
      tracking_number: "BR123456789BR",
    })

    expect(s.enviado).toBe(true)
    expect(s.carrier).toBe("Correios")
  })

  it("diz que um pedido sem código NÃO foi enviado", () => {
    expect(shippingSummary({}).enviado).toBe(false)
    expect(shippingSummary(null).enviado).toBe(false)
  })

  it("aceita metadata nulo sem quebrar a tela", () => {
    expect(() => shippingSummary(null)).not.toThrow()
  })

  it("cai no status padrão quando não há situação", () => {
    expect(shippingSummary({}).statusLabel).toBe(DEFAULT_STATUS_LABEL)
  })
})

describe("situacaoDoPedido", () => {
  it("lê o rótulo que o lojista ou o webhook gravou", () => {
    expect(situacaoDoPedido({ status_label: "Postada" })).toEqual({
      rotulo: "Postada",
      cancelado: false,
    })
  })

  it("usa o padrão quando não há rótulo", () => {
    expect(situacaoDoPedido({}).rotulo).toBe(DEFAULT_STATUS_LABEL)
    expect(situacaoDoPedido(null).rotulo).toBe(DEFAULT_STATUS_LABEL)
  })

  it("CANCELADO vence o rótulo: a tela não mostra 'Postada' num pedido cancelado", () => {
    const s = situacaoDoPedido({
      status_label: "Postada",
      superfrete_cancelada: true,
    })

    expect(s).toEqual({ rotulo: "Cancelado", cancelado: true })
  })

  it("só `true` cancela — o texto 'false' de um metadata antigo não cancela", () => {
    expect(situacaoDoPedido({ superfrete_cancelada: "true" }).cancelado).toBe(
      false
    )
  })
})

describe("rastreioPublico", () => {
  const pedido = {
    id: "order_123",
    display_id: 42,
    status: "pending",
    payment_status: "captured",
    created_at: "2026-10-01T10:00:00.000Z",
    total: 15990,
    currency_code: "brl",
    email: "cliente@exemplo.com",
    shipping_address: {
      first_name: "Ana",
      city: "Curitiba",
      province: "PR",
      postal_code: "80000-000",
      address_1: "Rua que não deve sair",
    },
    items: [
      {
        id: "item_1",
        title: "Tapete",
        quantity: 1,
        unit_price: 15990,
        thumbnail: "tapete.jpg",
      },
    ],
  }

  it("devolve o payment_status — o campo que o tipo do storefront exige", () => {
    const { order } = rastreioPublico(pedido, {}) as any

    expect(order.payment_status).toBe("captured")
  })

  it("NUNCA devolve o e-mail do pedido", () => {
    const resposta = rastreioPublico(pedido, {})

    expect(JSON.stringify(resposta)).not.toContain("cliente@exemplo.com")
  })

  it("não devolve o endereço completo, só o que a cliente precisa confirmar", () => {
    const { order } = rastreioPublico(pedido, {}) as any

    expect(order.shipping_address).toEqual({
      first_name: "Ana",
      city: "Curitiba",
      province: "PR",
      postal_code: "80000-000",
    })
    expect(order.shipping_address.address_1).toBeUndefined()
  })

  it("devolve null (e não string vazia) quando o envio não foi registrado", () => {
    const { order } = rastreioPublico(pedido, {}) as any

    expect(order.tracking).toEqual({
      tracking_number: null,
      tracking_url: null,
      carrier: null,
    })
  })

  it("leva ao storefront a situação e o cancelamento que o webhook gravou", () => {
    const { order } = rastreioPublico(pedido, {
      tracking_number: "BR123456789BR",
      status_label: "Postada",
      superfrete_situacao: "posted",
    }) as any

    expect(order.metadata).toEqual({
      order_status_label: "Postada",
      situacao: "posted",
      cancelado: false,
    })
  })

  it("um pedido cancelado SEM código sai como cancelado, não como pendente", () => {
    const { order } = rastreioPublico(pedido, {
      superfrete_cancelada: true,
    }) as any

    expect(order.tracking.tracking_number).toBeNull()
    expect(order.metadata.cancelado).toBe(true)
    expect(order.metadata.order_status_label).toBe("Cancelado")
  })

  it("aceita pedido sem endereço nem itens sem quebrar", () => {
    const resposta = rastreioPublico(
      { id: "o", display_id: 1 },
      null
    ) as any

    expect(resposta.order.shipping_address.first_name).toBeNull()
    expect(resposta.order.items).toEqual([])
  })
})
