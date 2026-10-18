import type { PedidoEnvio } from "./types"

export type EtiquetaDoPedido = {
  id: string
  situacao: string
  trackingUrl: string
  preco: number
}

export function etiquetaDoPedido(pedido: PedidoEnvio): EtiquetaDoPedido | null {
  const e = pedido.etiqueta

  if (!e || !e.id) {
    return null
  }

  return {
    id: e.id,
    situacao: e.situacao || "Etiqueta gerada",
    trackingUrl: e.trackingUrl,
    preco: Number(e.preco) || 0,
  }
}

export function acaoDoPedido(pedido: PedidoEnvio): {
  acao: "gerar" | "imprimir" | "aguardar"
  rotulo: string
  motivo: string
} {
  const etiqueta = etiquetaDoPedido(pedido)

  if (etiqueta) {
    return { acao: "imprimir", rotulo: "Imprimir etiqueta", motivo: "" }
  }

  if (!pagoDoPedido(pedido)) {
    return {
      acao: "aguardar",
      rotulo: "Aguardando pagamento",
      motivo: "A etiqueta sai quando o pagamento for capturado.",
    }
  }

  return { acao: "gerar", rotulo: "Gerar etiqueta", motivo: "" }
}

export function pagoDoPedido(pedido: PedidoEnvio): boolean {
  return pedido.payment_status === "captured" || pedido.payment_status === "partially_captured"
}

export function reais(centavos: number): string {
  const valor = Math.max(0, Math.round(Number(centavos) || 0))

  return `R$ ${Math.floor(valor / 100)},${String(valor % 100).padStart(2, "0")}`
}

export function saldoCurto(saldoCentavos: number, precoCentavos: number): boolean {
  return Number.isFinite(saldoCentavos) && saldoCentavos < precoCentavos
}
