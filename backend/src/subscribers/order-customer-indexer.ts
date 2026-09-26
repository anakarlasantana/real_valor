import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Subscriber responsável por indexar e catalogar o cliente automaticamente
 * quando um pedido é realizado sem login (Guest Checkout).
 *
 * Utiliza Email + CPF (em metadata.cpf) + Telefone/WhatsApp para identificar
 * ou criar o perfil do cliente no Medusa v2, garantindo histórico consolidado
 * sem necessidade de autenticação/senha.
 */
export default async function orderCustomerIndexerHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModuleService = container.resolve(Modules.ORDER)
  const customerModuleService = container.resolve(Modules.CUSTOMER)

  try {
    const orderId = data.id
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ["customer"],
    })

    if (!order) {
      logger.warn(`[Real Valor] Order ${orderId} not found for customer indexing.`)
      return
    }

    const email = order.email
    const metadata = (order.metadata || {}) as Record<string, any>
    const cpf = metadata.cpf ? String(metadata.cpf).replace(/\D/g, "") : null

    logger.info(`[Real Valor] Cataloging customer for order ${orderId} (Email: ${email}, CPF: ${cpf || "N/A"})`)

    // Se a order já tem cliente associado com conta existente, apenas atualiza metadados se necessário
    if (order.customer_id) {
      const existingCustomer = await customerModuleService.retrieveCustomer(order.customer_id)
      if (existingCustomer && cpf && (!existingCustomer.metadata || !existingCustomer.metadata.cpf)) {
        await customerModuleService.updateCustomers(order.customer_id, {
          metadata: {
            ...(existingCustomer.metadata || {}),
            cpf,
            whatsapp: metadata.whatsapp || order.shipping_address?.phone || null,
          },
        })
      }
      return
    }

    // Se não tem customer associado, busca por email
    // A anotação de tipo é obrigatória: sem ela o TypeScript infere `null` para
    // a variável e rejeita as atribuições de `CustomerDTO` abaixo, quebrando o
    // `yarn build` (e, portanto, o build da imagem de produção).
    let targetCustomer: Awaited<
      ReturnType<typeof customerModuleService.retrieveCustomer>
    > | null = null
    if (email) {
      const [customers] = await customerModuleService.listAndCountCustomers({
        email,
      })
      if (customers.length > 0) {
        targetCustomer = customers[0]
      }
    }

    // Se cliente não existe, cria um novo perfil sem conta de login (has_account: false)
    if (!targetCustomer && email) {
      targetCustomer = await customerModuleService.createCustomers({
        email,
        first_name: order.shipping_address?.first_name || "Cliente",
        last_name: order.shipping_address?.last_name || "Real Valor",
        phone: order.shipping_address?.phone || metadata.whatsapp || undefined,
        has_account: false,
        metadata: {
          cpf,
          whatsapp: metadata.whatsapp || order.shipping_address?.phone || null,
          created_via: "guest_checkout",
        },
      })
      logger.info(`[Real Valor] Created new guest customer profile (${targetCustomer.id}) for ${email}`)
    }

    // Se o cliente existe mas ainda não tinha CPF cadastrado nos metadados
    if (targetCustomer && cpf && (!targetCustomer.metadata || !targetCustomer.metadata.cpf)) {
      await customerModuleService.updateCustomers(targetCustomer.id, {
        metadata: {
          ...(targetCustomer.metadata || {}),
          cpf,
          whatsapp: metadata.whatsapp || order.shipping_address?.phone || null,
        },
      })
    }

    // Vincula a order ao customer catalogado
    if (targetCustomer) {
      await orderModuleService.updateOrders(orderId, {
        customer_id: targetCustomer.id,
      })
      logger.info(`[Real Valor] Successfully linked order ${orderId} to customer ${targetCustomer.id}`)
    }
  } catch (error) {
    logger.error(`[Real Valor] Error indexing customer for order: ${error}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
