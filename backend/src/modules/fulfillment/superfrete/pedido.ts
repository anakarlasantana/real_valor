// Traduz o pedido do Medusa para a etiqueta (`superfrete/pedido`).
import type { Remetente, Destinatario, PedidoParaEtiqueta } from "./etiqueta"
import { SERVICOS, ehServico, type Servico } from "./catalogo"
import { emCentavos } from "../dinheiro"

export function servicoDaOpcao(dados: unknown): Servico | null {
  const servico = String((dados as any)?.servico ?? "").trim().toUpperCase()

  return ehServico(servico) ? servico : null
}

export function cpfDoPedido(metadata: unknown): string {
  return String((metadata as any)?.cpf ?? "").trim()
}

/** `numero` e `bairro` moram no metadata do endereço: o Medusa não tem os campos (RV-041). */
function metadataDoEndereco(endereco: Record<string, any>): Record<string, any> {
  const metadata = endereco?.metadata

  return metadata && typeof metadata === "object"
    ? (metadata as Record<string, any>)
    : {}
}

/** `123`, `45A`, `12 B`: o que pode ser número de casa — "Apto 42" não é. */
function pareceNumero(valor: string): boolean {
  return /^\d{1,6}\s?[A-Za-z]?$/.test(valor.trim())
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
  const doEndereco = metadataDoEndereco(endereco)
  const address2 = String(endereco.address_2 ?? "").trim()

  /**
   * `metadata.numero` e, na falta dele, o que a cliente escreveu junto da rua. O
   * `address_2` só vale como número quando **é** número — "Apto 42" não é.
   */
  const numero =
    String(doEndereco.numero ?? "").trim() ||
    (pareceNumero(address2) ? address2 : "") ||
    partes.numero

  const complemento =
    partes.complemento ||
    (pareceNumero(address2) ? "" : address2) ||
    String(endereco.company ?? "").trim()

  return {
    nome: String(endereco.first_name ?? cliente.first_name ?? "").trim()
      .concat(" ", String(endereco.last_name ?? cliente.last_name ?? ""))
      .trim(),
    documento: cpfDoPedido(metadata),
    email: String(pedido?.email ?? cliente.email ?? "").trim(),
    telefone: String(endereco.phone ?? cliente.phone ?? "").trim(),
    cep: String(endereco.postal_code ?? "").trim(),
    rua: partes.rua,
    numero,
    complemento,
    /**
     * O bairro **nunca** sai do `province` (é a UF). Sem bairro,
     * `problemaDaEtiqueta` barra a emissão: melhor que imprimir o campo errado.
     */
    bairro: String(doEndereco.bairro ?? "").trim(),
    cidade: String(endereco.city ?? "").trim(),
    estado: String(endereco.province ?? "").trim().slice(0, 2).toUpperCase(),
  }
}

export function remetenteDoLocal(local: Record<string, any>): Remetente {
  const endereco = (local?.address ?? {}) as Record<string, any>
  const doEndereco = metadataDoEndereco(endereco)

  return {
    nome: String(local?.name ?? "RealValor").trim(),
    documento: String((local?.metadata as any)?.documento ?? "").trim(),
    telefone: String(endereco.phone ?? "").trim(),
    email: String((endereco.metadata as any)?.email ?? (local?.metadata as any)?.email ?? "").trim(),
    cep: String(endereco.postal_code ?? "").trim(),
    rua: String(endereco.address_1 ?? "").trim(),
    numero: String(doEndereco.numero ?? "").trim() || String(endereco.address_2 ?? "").trim(),
    complemento: "",
    /**
     * O local não tem bairro nem formulário para corrigi-lo: até alguém preencher
     * `metadata.bairro`, a UF é o que existe — vazio trava **toda** etiqueta.
     */
    bairro:
      String(doEndereco.bairro ?? "").trim() ||
      String(endereco.province ?? "").trim(),
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
        valorCentavos: emCentavos(unitario),
      },
    ]
  })
}

export function pago(fulfillment: unknown, payment: unknown): boolean {
  const status = String(payment ?? "").toLowerCase()
  const capturado = String(fulfillment ?? "").toLowerCase()

  return status === "captured" || status === "partially_captured" || capturado === "captured"
}
