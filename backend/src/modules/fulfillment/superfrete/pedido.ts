// Traduz o pedido do Medusa para a etiqueta (`superfrete/pedido`).
import type { Remetente, Destinatario, PedidoParaEtiqueta } from "./etiqueta"
import { SERVICOS, ehServico, type Servico } from "./catalogo"

export function servicoDaOpcao(dados: unknown): Servico | null {
  const servico = String((dados as any)?.servico ?? "").trim().toUpperCase()

  return ehServico(servico) ? servico : null
}

export function cpfDoPedido(metadata: unknown): string {
  return String((metadata as any)?.cpf ?? "").trim()
}

export function separarRua(endereco: unknown): {
  rua: string
  numero: string
  complemento: string
} {
  const bruto = String(endereco ?? "").trim()

  if (!bruto) {
    return { rua: "", numero: "", complemento: "" }
  }

  const [antesDoHifen, ...resto] = bruto.split(/\s+-\s+/)
  const complemento = resto.join(" - ").trim()
  const casado = antesDoHifen.match(/^(.*?)[,\s]+(\d+[A-Za-z]?)$/)

  if (!casado) {
    return { rua: antesDoHifen.trim(), numero: "", complemento }
  }

  return { rua: casado[1].trim(), numero: casado[2].trim(), complemento }
}

export function destinatarioDoPedido(
  pedido: Record<string, any>,
  metadata: unknown
): Destinatario {
  const endereco = (pedido?.shipping_address ?? pedido?.billing_address ?? {}) as Record<string, any>
  const partes = separarRua(endereco.address_1)
  const cliente = (pedido?.customer ?? {}) as Record<string, any>

  return {
    nome: String(endereco.first_name ?? cliente.first_name ?? "").trim()
      .concat(" ", String(endereco.last_name ?? cliente.last_name ?? ""))
      .trim(),
    documento: cpfDoPedido(metadata),
    email: String(pedido?.email ?? cliente.email ?? "").trim(),
    telefone: String(endereco.phone ?? cliente.phone ?? "").trim(),
    cep: String(endereco.postal_code ?? "").trim(),
    rua: partes.rua,
    numero: String(endereco.address_2 ?? "").trim() || partes.numero,
    complemento: partes.complemento || String(endereco.company ?? "").trim(),
    bairro: String(endereco.province ?? "").trim(),
    cidade: String(endereco.city ?? "").trim(),
    estado: String(endereco.province ?? "").trim().slice(0, 2).toUpperCase(),
  }
}

export function remetenteDoLocal(local: Record<string, any>): Remetente {
  const endereco = (local?.address ?? {}) as Record<string, any>

  return {
    nome: String(local?.name ?? "RealValor").trim(),
    documento: String((local?.metadata as any)?.documento ?? "").trim(),
    telefone: String(endereco.phone ?? "").trim(),
    email: String((endereco.metadata as any)?.email ?? (local?.metadata as any)?.email ?? "").trim(),
    cep: String(endereco.postal_code ?? "").trim(),
    rua: String(endereco.address_1 ?? "").trim(),
    numero: String(endereco.address_2 ?? "").trim(),
    complemento: "",
    bairro: String(endereco.province ?? "").trim(),
    cidade: String(endereco.city ?? "").trim(),
    estado: String(endereco.province ?? "").trim().slice(0, 2).toUpperCase(),
  }
}

export function produtosDoPedido(items: unknown): PedidoParaEtiqueta["produtos"] {
  return ((items ?? []) as Record<string, any>[]).flatMap((item) => {
    const quantidade = Math.floor(Number(item?.quantity) || 0)
    const unitario = Number(item?.unit_price)

    if (quantidade <= 0 || !Number.isFinite(unitario)) {
      return []
    }

    return [
      {
        nome: String(item?.product_title ?? item?.title ?? "Item"),
        quantidade,
        valorCentavos: Math.round(unitario),
      },
    ]
  })
}

export function pago(fulfillment: unknown, payment: unknown): boolean {
  const status = String(payment ?? "").toLowerCase()
  const capturado = String(fulfillment ?? "").toLowerCase()

  return status === "captured" || status === "partially_captured" || capturado === "captured"
}
