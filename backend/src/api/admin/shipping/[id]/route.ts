/**
 * POST /admin/shipping/:id — grava o registro de envio de um pedido, que é o
 * que `GET /store/orders/track` lê. A porta valida e grava; a regra mora em
 * `modules/shipping/tracking.ts`. Campo **ausente** é "deixe como está";
 * string vazia é "limpe".
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  avisar,
  buildShippingMetadata,
  shippingSummary,
  validateShippingUpdate,
  type ShippingUpdate,
} from "../../../../modules/shipping/tracking"

/** Os nomes do corpo da tela → os nomes da regra. */
const CAMPOS: Array<[keyof ShippingUpdate, string]> = [
  ["carrier", "carrier"],
  ["trackingNumber", "tracking_number"],
  ["trackingUrl", "tracking_url"],
  ["statusLabel", "status_label"],
]

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<MedusaResponse | void> {
  const id = String(req.params?.id ?? "")
  const body = (req.body ?? {}) as Record<string, unknown>

  const update: ShippingUpdate = {}
  for (const [campo, chave] of CAMPOS) {
    // `undefined` = não veio = não mexe. `""` = veio vazio = limpa.
    if (Object.prototype.hasOwnProperty.call(body, chave)) {
      update[campo] = String(body[chave] ?? "")
    }
  }

  const erro = validateShippingUpdate(update)
  if (erro) {
    return res.status(400).json({ message: erro })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: Record<string, unknown>) => Promise<{ data: unknown[] }>
  }

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "metadata",
      "shipping_address.first_name",
      "shipping_address.country_code",
    ],
    filters: { id },
  })

  const pedido = (data ?? [])[0] as
    | (Record<string, any> & { id: string })
    | undefined

  if (!pedido) {
    return res.status(404).json({ message: "Pedido não encontrado." })
  }

  const envio = buildShippingMetadata(
    (pedido.metadata ?? {}) as Record<string, unknown>,
    update
  )

  // O `metadata` é MESCLADO, nunca substituído: ele também guarda o CPF e o
  // e-mail que a rota de rastreio usa para validar a identidade da cliente.
  // regravar o objeto inteiro faria toda consulta de rastreio virar 403.
  // `ContainerRegistrationKeys` não tem uma chave para o módulo de pedido; o
  // nome do container é a string `"order"`.
  const orderService = req.scope.resolve("order") as {
    updateOrders: (
      ids: string[],
      data: Record<string, unknown>
    ) => Promise<unknown>
  }

  await orderService.updateOrders([id], {
    metadata: {
      ...((pedido.metadata ?? {}) as Record<string, unknown>),
      ...envio,
    },
  })

  // Só avisa quando o código ou a situação mudam: salvar sem mexer não é fato.
  const antes = shippingSummary(pedido.metadata)
  const depois = shippingSummary(envio)
  const mudou =
    antes.trackingNumber !== depois.trackingNumber ||
    antes.statusLabel !== depois.statusLabel

  if (mudou) {
    await avisar(
      req.scope,
      depois.trackingNumber ? "saiu" : "atualizado",
      pedido,
      envio
    )
  }

  res.status(200).json({
    id,
    envio: shippingSummary(envio),
  })
}
