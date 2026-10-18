/** O webhook do SuperFrete: confere o HMAC e emite (§15.4.2 do doc 15). */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import {
  assinaturaConfere,
  entregaDoAviso,
  HEADER_ASSINATURA,
} from "../../../modules/fulfillment/superfrete/webhook"

/** O evento que o subscriber `superfrete-webhook` escuta. */
export const EVENTO_DA_ENTREGA = "superfrete.entrega"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger") as { warn: (m: string) => void }
  const cabecalhos = (req.headers ?? {}) as Record<string, unknown>

  const recebida = Object.entries(cabecalhos).find(
    ([nome]) => nome.toLowerCase() === HEADER_ASSINATURA
  )?.[1]

  // O HMAC é sobre os bytes crus; o JSON reserializado mudaria a ordem das chaves.
  const cru = req.rawBody ?? JSON.stringify(req.body ?? {})

  if (!assinaturaConfere(cru, recebida, process.env.SUPERFRETE_WEBHOOK_SECRET ?? "")) {
    logger.warn("[superfrete/webhook] notificação recusada (assinatura inválida)")
    res.status(401).json({ recebido: false })
    return
  }

  // `200` para `created`/`released`: erro faria reentrega de nada.
  const aviso = entregaDoAviso(req.body)

  if (!aviso) {
    res.status(200).json({ recebido: true, tratado: false })
    return
  }

  const eventBus = req.scope.resolve(Modules.EVENT_BUS) as {
    emit: (evento: { name: string; data: unknown }) => Promise<unknown>
  }

  await eventBus.emit({ name: EVENTO_DA_ENTREGA, data: aviso })

  res.status(200).json({ recebido: true, tratado: true })
}
