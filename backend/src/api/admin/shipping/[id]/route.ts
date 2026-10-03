/**
 * POST /admin/shipping/:id — grava o registro de envio de um pedido.
 * -------------------------------------------------------------------------
 * É a outra ponta de `GET /store/orders/track`: a rota pública lê o que esta
 * porta grava. Sem esta porta, a rota pública está pronta e sempre responde
 * `null` — foi a lacuna que o RV-043 fecha.
 *
 * **A porta é deliberadamente simples:** valida, monta o `metadata` e grava.
 * A regra mora em `modules/shipping/tracking.ts`, porque é a parte que precisa
 * de teste e não tem I/O.
 *
 * O corpo aceita campos **ausentes** de propósito: a tela de envio manda só o
 * que o lojista mudou. Ausente é "deixe como está", e string vazia é "limpe".
 * Essa distinção é o que permite corrigir a transportadora sem redigitar o
 * código, e é conferida por teste em `tracking.unit.spec.ts`.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
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
    fields: ["id", "metadata"],
    filters: { id },
  })

  const pedido = (data ?? [])[0] as Record<string, any> | undefined

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

  res.status(200).json({
    id,
    envio: shippingSummary(envio),
  })
}
