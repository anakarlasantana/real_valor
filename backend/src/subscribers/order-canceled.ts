import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { enviarEmail, mascararEmail } from "../modules/notification/enviar";
import { dadosDoPedidoCancelado } from "../modules/notification/pedido";
import { TEMPLATE_PEDIDO_CANCELADO } from "../modules/notification/templates";

/**
 * O e-mail de pedido cancelado pelo Admin. O webhook do SuperFrete já cobre o
 * cancelamento da etiqueta; os dois usam a chave `order-canceled:<id>`, então
 * um cancelamento que dispara os dois eventos gera um e-mail só.
 * Ver modules/notification/README.md.
 */
export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orders = container.resolve(Modules.ORDER);

  try {
    const order = await orders.retrieveOrder(data.id, {
      relations: ["shipping_address"],
      select: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "payment_status",
        "created_at",
        "metadata",
      ],
    });

    if (!order?.email) {
      logger.warn(
        `[email] pedido ${data.id} sem e-mail: cancelamento não enviado.`,
      );
      return;
    }

    const enviado = await enviarEmail(container, {
      to: order.email,
      template: TEMPLATE_PEDIDO_CANCELADO,
      data: dadosDoPedidoCancelado(
        order,
        process.env.STOREFRONT_URL,
        order.metadata as Record<string, unknown> | null,
      ),
      idempotencyKey: `order-canceled:${order.id}`,
      triggerType: "order.canceled",
      resourceId: order.id,
    });

    if (enviado) {
      logger.info(
        `[email] cancelamento do pedido ${order.display_id ?? order.id} enviado para ${mascararEmail(
          order.email,
        )}.`,
      );
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    logger.error(
      `[email] falha ao preparar o cancelamento do pedido ${data.id}: ${mensagem}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
