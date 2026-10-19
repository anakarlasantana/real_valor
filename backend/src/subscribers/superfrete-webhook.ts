/**
 * O aviso do SuperFrete vira `metadata` do pedido: a rota valida e emite, aqui
 * o aviso é traduzido e gravado (§15.4.2 do doc 15).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

import {
  metadataDoAviso,
  type EntregaDoAviso,
} from "../modules/fulfillment/superfrete/webhook"
import { pedidoDaEtiqueta, type PedidoNoVinculo } from "../modules/fulfillment/superfrete/vinculo"
import { avisar } from "../modules/shipping/tracking"

/** O nome do evento, duplicado da rota de propósito: subscriber não importa `api/`. */
export const EVENTO_DA_ENTREGA = "superfrete.entrega"

export default async function superfreteWebhookHandler({
  event,
  container,
}: SubscriberArgs<EntregaDoAviso>) {
  const logger = container.resolve<{ info: (m: string) => void; warn: (m: string) => void }>(
    "logger"
  )

  const aviso = event.data

  const pedidos = container.resolve<{
    listOrders: (
      filtro: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<PedidoNoVinculo[]>
    updateOrders: (id: string, data: Record<string, unknown>) => Promise<unknown>
  }>(Modules.ORDER)

  const pedidoId = await pedidoDaEtiqueta({
    etiqueta: aviso.etiqueta,
    listar: (filtro, config) =>
      pedidos.listOrders(filtro, { ...config, select: ["id", "metadata"] }),
  })

  if (!pedidoId) {
    logger.warn(`[superfrete/webhook] etiqueta ${aviso.etiqueta} sem pedido na janela — aviso descartado`)
    return
  }

  const [pedido] = await pedidos.listOrders(
    { id: pedidoId },
    { select: ["id", "display_id", "metadata"] }
  )

  const depois = metadataDoAviso(aviso, pedido?.metadata)

  if (!depois) {
    logger.info(`[superfrete/webhook] etiqueta ${aviso.etiqueta}: "${aviso.evento}" não muda nada`)
    return
  }

  // `updateOrders` sobrescreve o `metadata` inteiro: `depois` já traz o que
  // estava lá, e é o que preserva o CPF que o rastreio valida.
  await pedidos.updateOrders(pedidoId, { metadata: depois })

  // O aviso à cliente (RV-045): quem sabe do fato é o webhook. Hoje `avisar`
  // só registra no log.
  await avisar(
    depois.superfrete_cancelada === true ? "cancelado" : "saiu",
    pedido as { display_id?: number | null },
    depois
  )

  // A vitrine usa tag por sessão (`orders-<cacheId>`), que o backend não alcança.
  logger.info(`[superfrete/webhook] pedido ${pedidoId}: ${aviso.situacao}`)
}

export const config: SubscriberConfig = {
  event: EVENTO_DA_ENTREGA,
}
