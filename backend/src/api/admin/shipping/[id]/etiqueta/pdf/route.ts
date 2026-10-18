import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ambienteDaConfig, chamarSuperFrete } from "../../../../../../modules/fulfillment/superfrete/cliente"
import { urlDaEtiqueta } from "../../../../../../modules/fulfillment/superfrete/etiqueta"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String(req.params?.id ?? "")
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

  const etiqueta = String((pedido.metadata ?? {}).superfrete_id ?? "").trim()

  if (!etiqueta) {
    res.status(409).json({ message: "Este pedido ainda não tem etiqueta. Gere primeiro." })
    return
  }

  const resultado = await urlDaEtiqueta({
    id: etiqueta,
    config: {
      token: process.env.SUPERFRETE_TOKEN ?? "",
      ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
    },
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(502).json({ message: resultado.mensagem })
    return
  }

  res.status(200).json({ url: resultado.url })
}
