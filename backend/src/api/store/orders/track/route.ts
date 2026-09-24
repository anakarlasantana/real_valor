import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Endpoint de Rastreamento de Pedido sem Login (Zero Fricção)
 * GET /store/orders/track?display_id=123&cpf=12345678900 ou ?order_id=...&email=...
 *
 * Permite ao cliente acompanhar o status do pedido, código de rastreamento de frete,
 * itens e status de pagamento apenas informando o número do pedido e CPF ou E-mail.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.query as {
    order_id?: string
    display_id?: string
    cpf?: string
    email?: string
  }

  const { order_id, display_id, cpf, email } = query

  if (!order_id && !display_id) {
    return res.status(400).json({
      message: "Informe o número do pedido (display_id) ou o ID do pedido.",
    })
  }

  if (!cpf && !email) {
    return res.status(400).json({
      message: "Para segurança da consulta, informe o CPF ou o E-mail utilizado na compra.",
    })
  }

  const orderModuleService = req.scope.resolve(Modules.ORDER)

  try {
    const filters: Record<string, any> = {}
    if (order_id) {
      filters.id = order_id
    }
    if (display_id) {
      filters.display_id = Number(display_id)
    }

    const [orders] = await orderModuleService.listAndCountOrders(filters, {
      relations: ["items", "shipping_methods", "shipping_address"],
    })

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: "Pedido não encontrado. Verifique os dados informados.",
      })
    }

    const order = orders[0]
    const orderMetadata = (order.metadata || {}) as Record<string, any>
    const cleanQueryCpf = cpf ? String(cpf).replace(/\D/g, "") : null
    const orderCpf = orderMetadata.cpf ? String(orderMetadata.cpf).replace(/\D/g, "") : null

    // Validação de segurança: o CPF ou Email deve bater com os dados do pedido
    const emailMatches = email && order.email && order.email.toLowerCase() === email.toLowerCase()
    const cpfMatches = cleanQueryCpf && orderCpf && orderCpf === cleanQueryCpf

    if (!emailMatches && !cpfMatches) {
      return res.status(403).json({
        message: "Dados de identificação (CPF ou E-mail) não correspondem a este pedido.",
      })
    }

    // Retorna os dados sanitizados para o cliente (sem expor credenciais internas)
    return res.json({
      order: {
        id: order.id,
        display_id: order.display_id,
        status: order.status,
        created_at: order.created_at,
        email: order.email,
        total: order.total,
        currency_code: order.currency_code,
        shipping_address: {
          first_name: order.shipping_address?.first_name,
          city: order.shipping_address?.city,
          province: order.shipping_address?.province,
          postal_code: order.shipping_address?.postal_code,
        },
        items: (order.items || []).map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          thumbnail: item.thumbnail,
        })),
        tracking: {
          tracking_number: orderMetadata.tracking_number || null,
          tracking_url: orderMetadata.tracking_url || null,
          carrier: orderMetadata.carrier || null,
        },
        metadata: {
          order_status_label: orderMetadata.status_label || "Em Processamento",
        },
      },
    })
  } catch (error) {
    return res.status(500).json({
      message: "Erro interno ao consultar pedido.",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
}
