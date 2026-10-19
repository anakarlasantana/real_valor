import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ambienteDaConfig, chamarSuperFrete } from "../../../../../../modules/fulfillment/superfrete/cliente"
import { cancelarEtiqueta, situacaoDaEtiqueta } from "../../../../../../modules/fulfillment/superfrete/etiqueta"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String(req.params?.id ?? "")
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: Record<string, unknown>) => Promise<{ data: unknown[] }>
  }

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id },
  })
  const pedido = (data ?? [])[0] as Record<string, any> | undefined

  if (!pedido) {
    res.status(404).json({ message: "Pedido não encontrado." })
    return
  }

  const metadata = (pedido.metadata ?? {}) as Record<string, unknown>
  const etiqueta = String(metadata.superfrete_id ?? "").trim()

  if (!etiqueta) {
    res.status(409).json({ message: "Este pedido não tem etiqueta para cancelar." })
    return
  }

  const resultado = await cancelarEtiqueta({
    id: etiqueta,
    motivo: String(corpo.motivo ?? ""),
    config: {
      token: process.env.SUPERFRETE_TOKEN ?? "",
      ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
    },
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(resultado.status).json({ message: resultado.mensagem })
    return
  }

  const orderService = req.scope.resolve("order") as {
    updateOrders: (ids: string[], data: Record<string, unknown>) => Promise<unknown>
  }

  await orderService.updateOrders([id], {
    metadata: {
      ...metadata,
      superfrete_cancelada: etiqueta,
      status_label: situacaoDaEtiqueta("cancelled"),
    },
  })

  res.status(200).json({
    cancelada: etiqueta,
    estorno: "O valor foi estornado para a carteira SuperFrete.",
  })
}
