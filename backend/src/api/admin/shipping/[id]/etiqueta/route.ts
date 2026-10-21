import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ambienteDaConfig, chamarSuperFrete } from "../../../../../modules/fulfillment/superfrete/cliente"
import { situacaoDaEtiqueta, emitirEtiqueta, linkDeRastreio } from "../../../../../modules/fulfillment/superfrete/etiqueta"
import { destinatarioDoPedido, pago, produtosDoPedido, remetenteDoLocal, servicoDaOpcao } from "../../../../../modules/fulfillment/superfrete/pedido"
import { caixaDoEnvio, problemaDaEtiqueta } from "../../../../../modules/fulfillment/superfrete/etiqueta"
import { transportadoraDo } from "../../../../../modules/fulfillment/superfrete/catalogo"
import { PACOTES_MODULE } from "../../../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../../../modules/fulfillment/pacotes/service"

const CAMPOS = [
  "id",
  "display_id",
  "email",
  "status",
  "payment_status",
  "metadata",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.phone",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.phone",
  // Número e bairro não são campos do endereço no Medusa: vêm no metadata dele.
  "shipping_address.metadata",
  "billing_address.first_name",
  "billing_address.last_name",
  "billing_address.address_1",
  "billing_address.address_2",
  "billing_address.city",
  "billing_address.province",
  "billing_address.postal_code",
  "billing_address.phone",
  "billing_address.metadata",
  "items.title",
  "items.product_title",
  "items.quantity",
  "items.unit_price",
  "shipping_methods.shipping_option_id",
  "shipping_methods.data",
  "shipping_methods.amount",
] as const

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String(req.params?.id ?? "")
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: Record<string, unknown>) => Promise<{ data: unknown[] }>
  }

  const { data } = await query.graph({ entity: "order", fields: [...CAMPOS], filters: { id } })
  const pedido = (data ?? [])[0] as Record<string, any> | undefined

  if (!pedido) {
    res.status(404).json({ message: "Pedido não encontrado." })
    return
  }

  const metadata = (pedido.metadata ?? {}) as Record<string, unknown>

  if (String(metadata.superfrete_id ?? "").trim()) {
    res.status(409).json({
      message: "Este pedido já tem etiqueta. Use Imprimir ou Cancelar.",
      etiqueta: metadata.superfrete_id,
    })
    return
  }

  const metodo = ((pedido.shipping_methods ?? []) as Record<string, any>[])[0] ?? {}
  const servico = servicoDaOpcao(metodo?.data)

  const { data: locais } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "metadata", "address.address_1", "address.address_2", "address.city", "address.province", "address.postal_code", "address.phone"],
  })

  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const caixas = (await pacotes.listar()) as any
  const caixa = caixaDoEnvio(caixas)

  const paraEtiqueta = {
    numero: Number(pedido.display_id) || 0,
    servico: (servico ?? "PAC") as any,
    remetente: remetenteDoLocal((locais ?? [])[0] as Record<string, any>),
    destinatario: destinatarioDoPedido(pedido, metadata),
    produtos: produtosDoPedido(pedido.items),
    pago: pago(pedido.fulfillment_status, pedido.payment_status),
  }

  if (!servico) {
    res.status(422).json({
      message: "O pedido não foi enviado pelos Correios: não há serviço na opção de frete.",
    })
    return
  }

  const problema = problemaDaEtiqueta(paraEtiqueta)

  if (problema) {
    res.status(problema.status).json({ message: problema.mensagem })
    return
  }

  if (!caixa) {
    res.status(422).json({
      message: `Nenhuma caixa ativa serve para a ${transportadoraDo(paraEtiqueta.servico)}. Confira os pacotes.`,
    })
    return
  }

  const resultado = await emitirEtiqueta({
    pedido: paraEtiqueta,
    caixa,
    config: { token: process.env.SUPERFRETE_TOKEN ?? "", ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE) },
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(resultado.status).json({ message: resultado.mensagem, etiqueta: resultado.id })
    return
  }

  const orderService = req.scope.resolve("order") as {
    updateOrders: (ids: string[], data: Record<string, unknown>) => Promise<unknown>
  }

  // O `metadata` é mesclado: ele também guarda o CPF que o rastreio valida.
  await orderService.updateOrders([id], {
    metadata: {
      ...metadata,
      carrier: transportadoraDo(paraEtiqueta.servico),
      superfrete_id: resultado.id,
      superfrete_preco: resultado.precoCentavos,
      status_label: situacaoDaEtiqueta(resultado.situacao),
      tracking_url: linkDeRastreio(resultado.id),
    },
  })

  res.status(201).json({
    etiqueta: resultado.id,
    preco: resultado.precoCentavos,
    situacao: situacaoDaEtiqueta(resultado.situacao),
    tracking_url: linkDeRastreio(resultado.id),
  })
}
