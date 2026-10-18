import { acaoDoPedido, etiquetaDoPedido, pagoDoPedido, reais, saldoCurto } from "../etiqueta-fila"
import type { PedidoEnvio } from "../types"

const pedido = (extra: Partial<PedidoEnvio> = {}): PedidoEnvio => ({
  id: "order_1",
  display_id: 1042,
  email: "maria@exemplo.com",
  status: "pending",
  payment_status: "captured",
  created_at: "2026-10-18T10:00:00Z",
  resumo: "1x Kit",
  envio: {
    enviado: false,
    carrier: "",
    trackingNumber: "",
    trackingUrl: "",
    statusLabel: "Em processamento",
  },
  ...extra,
})

describe("acaoDoPedido", () => {
  it("pede a etiqueta num pedido pago e sem etiqueta", () => {
    expect(acaoDoPedido(pedido())).toEqual({
      acao: "gerar",
      rotulo: "Gerar etiqueta",
      motivo: "",
    })
  })

  it("espera o pagamento em vez de oferecer um botão que falha com 409", () => {
    const acao = acaoDoPedido(pedido({ payment_status: "authorized" }))
    expect(acao.acao).toBe("aguardar")
    expect(acao.motivo).toContain("pagamento")
  })

  it("manda imprimir quando a etiqueta já existe", () => {
    const acao = acaoDoPedido(
      pedido({
        etiqueta: {
          id: "abc123",
          situacao: "Aguardando postagem",
          trackingUrl: "https://rastreio.superfrete.com/#/tracking/abc123",
          preco: 3427,
        },
      })
    )

    expect(acao.acao).toBe("imprimir")
    expect(acao.rotulo).toContain("Imprimir")
  })
})

describe("etiquetaDoPedido", () => {
  it("devolve null quando o pedido não tem etiqueta", () => {
    expect(etiquetaDoPedido(pedido())).toBeNull()
  })

  it("devolve null quando o id vem vazio", () => {
    expect(
      etiquetaDoPedido(
        pedido({ etiqueta: { id: "", situacao: "", trackingUrl: "", preco: 0 } })
      )
    ).toBeNull()
  })

  it("usa um rótulo quando a situação vem vazia", () => {
    const etiqueta = etiquetaDoPedido(
      pedido({ etiqueta: { id: "x", situacao: "", trackingUrl: "", preco: 0 } })
    )

    expect(etiqueta?.situacao).toBe("Etiqueta gerada")
  })
})

describe("pagoDoPedido", () => {
  it("só conta pagamento capturado", () => {
    expect(pagoDoPedido(pedido())).toBe(true)
    expect(pagoDoPedido(pedido({ payment_status: "awaiting" }))).toBe(false)
  })
})

describe("reais", () => {
  it("mostra centavos com vírgula", () => {
    expect(reais(3427)).toBe("R$ 34,27")
    expect(reais(100)).toBe("R$ 1,00")
    expect(reais(5)).toBe("R$ 0,05")
  })

  it("nunca mostra centavo negativo", () => {
    expect(reais(-10)).toBe("R$ 0,00")
  })
})

describe("saldoCurto", () => {
  it("avisa quando a carteira não paga a etiqueta", () => {
    expect(saldoCurto(1000, 3427)).toBe(true)
    expect(saldoCurto(5000, 3427)).toBe(false)
    expect(saldoCurto(3427, 3427)).toBe(false)
  })
})
