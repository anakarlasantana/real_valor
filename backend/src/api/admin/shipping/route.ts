/**
 * GET /admin/shipping — os pedidos que o painel precisa mostrar.
 * -------------------------------------------------------------------------
 * A lista de trabalho do envio: pedidos **pagos e ainda não despachados**, e
 * os já despachados, para o lojista achar o que ele precisa corrigir sem saber
 * o número de pedido.
 *
 * Por que a rota lista em vez de a tela pedir pedido por pedido: o lojista não
 * tem o `display_id` da cliente na mão — quem tem é o time de atendimento. A
 * tela é "o que está esperando envio", e um número de pedido sem contexto não
 * ajuda ninguém a decidir o que despachar primeiro.
 *
 * A ordenação é por **criação do pedido, do mais antigo para o mais novo**: é
 * a ordem em que os pedidos precisam sair, e o mais antigo é sempre o mais
 * atrasado.
 *
 * A lista vem com o `metadata` cru de propósito. Quem sabe o que é
 * `tracking_number` é `shippingSummary` (`modules/shipping/tracking.ts`) — a
 * mesma função que a tela usa, então não há duas leituras do mesmo dado.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { shippingSummary } from "../../../modules/shipping/tracking"

/** Quantos pedidos a tela carrega. Suficiente para uma fila de envio. */
const LIMITE = 100

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: Record<string, unknown>) => Promise<{ data: unknown[] }>
  }

  const { data: pedidos } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "email",
      "status",
      "payment_status",
      "fulfillment_status",
      "metadata",
      "items.title",
    ],
    pagination: { take: LIMITE, order: { created_at: "ASC" } },
  })

  const linhas = (pedidos ?? []).map((pedido) => {
    const p = pedido as Record<string, any>

    return {
      id: String(p.id),
      display_id: Number(p.display_id),
      email: String(p.email ?? ""),
      status: String(p.status ?? ""),
      payment_status: String(p.payment_status ?? ""),
      created_at: String(p.created_at ?? ""),
      // Só o primeiro item serve para identificar o pedido na fila; a lista
      // completa vive no detalhe.
      resumo: (p.items ?? [])
        .map((item: Record<string, any>) => `${item.quantity}x ${item.title}`)
        .join(", "),
      envio: shippingSummary((p.metadata ?? {}) as Record<string, unknown>),
    }
  })

  res.status(200).json({ pedidos: linhas })
}