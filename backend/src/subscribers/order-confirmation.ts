import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

import { enviarEmail, mascararEmail } from "../modules/notification/enviar"
import { dadosDoPedidoConfirmado } from "../modules/notification/pedido"
import { TEMPLATE_PEDIDO_CONFIRMADO } from "../modules/notification/templates"

/**
 * O e-mail de pedido confirmado, em `order.placed` (o pedido só nasce quando o
 * pagamento é aprovado; ouvir `payment_captured` duplicaria). O texto mora no
 * template `pedido-confirmado`; a chave de idempotência é `order-placed:<id>`.
 * Ver modules/notification/README.md.
 */
export default async function orderConfirmationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orders = container.resolve(Modules.ORDER)

  try {
    const order = await orders.retrieveOrder(data.id, {
      relations: ["items", "shipping_address", "shipping_methods"],
    })

    if (!order?.email) {
      logger.warn(
        `[email] pedido ${data.id} sem e-mail: confirmação não enviada.`
      )
      return
    }

    const enviado = await enviarEmail(container, {
      to: order.email,
      template: TEMPLATE_PEDIDO_CONFIRMADO,
      data: dadosDoPedidoConfirmado(order, process.env.STOREFRONT_URL),
      idempotencyKey: `order-placed:${order.id}`,
      triggerType: "order.placed",
      resourceId: order.id,
    })

    if (enviado) {
      logger.info(
        `[email] confirmação do pedido ${order.display_id ?? order.id} enviada para ${mascararEmail(
          order.email
        )}.`
      )
    }
  } catch (erro) {
    // Nunca relança: o pedido já existe, e o evento não pode entrar em loop.
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    logger.error(
      `[email] falha ao preparar a confirmação do pedido ${data.id}: ${mensagem}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
