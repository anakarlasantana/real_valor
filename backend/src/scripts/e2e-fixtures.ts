import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createOrderWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  updateProductsWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

/** Os meios que a **loja** mostra (o `pp_system_default` é filtrado pela vitrine). */
export const PROVEDORES_DE_PAGAMENTO_E2E = [
  "pp_mercadopago_pix",
  "pp_mercadopago_cartao",
] as const

/**
 * Fixtures do teste ponta-a-ponta — **só** a stack `rv_e2e` chama isto.
 * -------------------------------------------------------------------------
 *   yarn e2e:fixtures        (via `scripts/e2e-stack.sh up`)
 *
 * Cria o que a jornada precisa e que **não** é dado de loja:
 *
 *   1. uma peça de teste, com preço, com perfil de envio, publicada e no canal
 *      online;
 *   2. uma opção de envio de **preço fixo** — a jornada não pode depender de
 *      saldo na transportadora.
 *
 * Idempotente: casa pelo `handle` da peça e pelo nome da opção.
 *
 * Por que no backend: criar peça exige os workflows do Medusa (perfil, zona,
 * preço); pela API do admin seriam meia dúzia de chamadas com ids no meio.
 */
export const PRODUTO_E2E = {
  title: "[e2e] Vestido de Teste",
  handle: "e2e-vestido-de-teste",
  sku: "E2E-UNICO",
  precoCentavos: 19990,
} as const

export const ENVIO_E2E = {
  name: "E2E — Envio fixo",
  precoCentavos: 1990,
} as const

export default async function e2eFixtures({
  container,
}: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannel = container.resolve(Modules.SALES_CHANNEL)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const canais = await salesChannel.listSalesChannels({
    name: "Loja Online Real Valor",
  })

  if (!canais.length) {
    throw new Error(
      "Canal 'Loja Online Real Valor' não existe — rode `yarn seed` antes dos fixtures."
    )
  }

  const perfis = await fulfillment.listShippingProfiles({ type: "default" })

  if (!perfis.length) {
    throw new Error("Sem perfil de envio — rode `yarn seed` antes dos fixtures.")
  }

  // A loja **filtra** o `pp_system_default`, então a região do e2e precisa dos
  // meios reais; sem isso o checkout abriria em "pagamento indisponível".
  const { data: regioes } = await query.graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
    filters: { currency_code: "brl" },
  })

  const atuais = new Set(
    (regioes?.[0]?.payment_providers ?? []).map((provider: any) =>
      String(provider?.id)
    )
  )
  const faltam = PROVEDORES_DE_PAGAMENTO_E2E.filter((id) => !atuais.has(id))

  if (regioes?.[0] && faltam.length) {
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: regioes[0].id },
        update: { payment_providers: [...atuais, ...faltam] },
      },
    })

    logger.info(`[e2e] meios de pagamento na região: ${faltam.join(", ")}.`)
  }

  const { data: existentes } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { handle: PRODUTO_E2E.handle },
  })
  if (existentes?.length) {
    logger.info(`[e2e] peça já existe (${PRODUTO_E2E.handle}).`)

    // Sem perfil de envio o Medusa filtra os itens do carrinho no cálculo do
    // frete e a cotação responde 500 ("o pedido não tem itens para enviar").
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: existentes[0].id },
        update: { shipping_profile_id: perfis[0].id },
      },
    })
  } else {
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: PRODUTO_E2E.title,
            handle: PRODUTO_E2E.handle,
            status: "published",
            shipping_profile_id: perfis[0].id,
            description: "Peça criada pela stack de teste ponta-a-ponta.",
            options: [{ title: "Tamanho", values: ["Único"] }],
            variants: [
              {
                title: "Único",
                sku: PRODUTO_E2E.sku,
                // Sem inventário: a jornada testa a loja, não o estoque.
                manage_inventory: false,
                options: { Tamanho: "Único" },
                prices: [
                  {
                    // `amount` é em reais; a constante é em centavos.
                    amount: PRODUTO_E2E.precoCentavos / 100,
                    currency_code: "brl",
                  },
                ],
              },
            ],
            sales_channels: [{ id: canais[0].id }],
          },
        ],
      },
    })

    logger.info(`[e2e] peça criada: ${PRODUTO_E2E.handle}.`)
  }

  const { data: sets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "service_zones.id"],
    filters: { name: "Envio Nacional Brasil" },
  })

  const zona = sets?.[0]?.service_zones?.[0]?.id

  if (!zona) {
    throw new Error(
      "Sem fulfillment set/zona — rode `yarn seed` antes dos fixtures."
    )
  }

  const { data: opcoes } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
    filters: { shipping_profile_id: perfis[0].id },
  })

  if (opcoes?.some((opcao) => opcao.name === ENVIO_E2E.name)) {
    logger.info(`[e2e] envio já existe (${ENVIO_E2E.name}).`)
  } else {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: ENVIO_E2E.name,
          price_type: "flat" as const,
          provider_id: "manual_manual",
          service_zone_id: zona,
          shipping_profile_id: perfis[0].id,
          prices: [
            { amount: ENVIO_E2E.precoCentavos / 100, currency_code: "brl" },
          ],
          // O Medusa exige o TIPO da opção (`shipping_option_type_id`): sem este
          // bloco o workflow falha com "ShippingOption.shipping_option_type_id
          // is required". O `code` é livre, mas precisa ser único.
          type: {
            label: "Envio fixo",
            description: "Opção de teste ponta-a-ponta, com preço fixo.",
            code: "e2e_flat",
          },
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq" as const,
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq" as const,
            },
          ],
        },
      ],
    })

    logger.info(`[e2e] envio criado: ${ENVIO_E2E.name}.`)
  }

  try {
    await pedidosDeTeste(container)
  } catch (erro) {
    logger.error(`[e2e] pedidos: ${String((erro as Error)?.message ?? erro)}`)
    throw erro
  }
}

async function pedidosDeTeste(container: ExecArgs["container"]): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: jaExistem } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
  })

  const marcados = new Set(
    (jaExistem ?? [])
      .map((pedido: any) => String(pedido?.metadata?.e2e_pedido ?? ""))
      .filter(Boolean)
  )

  if (marcados.has("pago") && marcados.has("pendente")) {
    logger.info("[e2e] pedidos de teste já existem (pago e pendente).")
    return
  }

  const { data: regioes } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: "brl" },
  })
  const regiao = regioes?.[0]

  const { data: variantes } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku"],
    filters: { sku: PRODUTO_E2E.sku },
  })
  const variante = variantes?.[0]

  const { data: opcoesDeEnvio } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { name: ENVIO_E2E.name },
  })
  const metodo = opcoesDeEnvio?.[0]

  if (!regiao || !variante || !metodo) {
    throw new Error(
      "Sem região, variante ou opção de envio — rode os fixtures base antes."
    )
  }

  const endereco = {
    first_name: "Cliente",
    last_name: "E2E",
    address_1: "Rua das Flores, 100",
    city: "Fortaleza",
    province: "CE",
    postal_code: "60000000",
    country_code: "br",
    phone: "85999999999",
    metadata: { numero: "100", bairro: "Centro" },
  }

  for (const cenario of ["pago", "pendente"] as const) {
    if (marcados.has(cenario)) {
      continue
    }

    const { result } = await createOrderWorkflow(container).run({
      input: {
        region_id: regiao.id,
        email: `lojista-${cenario}@realvalor.test`,
        items: [
          {
            title: PRODUTO_E2E.title,
            variant_id: variante.id,
            quantity: 1,
            unit_price: PRODUTO_E2E.precoCentavos / 100,
          },
        ],
        shipping_methods: [
          {
            name: ENVIO_E2E.name,
            shipping_option_id: metodo.id,
            amount: ENVIO_E2E.precoCentavos / 100,
          },
        ],
        shipping_address: endereco,
        billing_address: endereco,
        metadata: { e2e_pedido: cenario, cpf: "52998224725" },
      },
    })

    const orderService = container.resolve("order") as {
      updateOrders: (
        data: Array<{ id: string; metadata?: Record<string, unknown> }>
      ) => Promise<unknown>
    }
    const { id: orderId } = result as { id: string }

    await orderService.updateOrders([{ id: orderId, metadata: { e2e_pedido: cenario, cpf: "52998224725" } }])

    if (cenario === "pago") {
      const { createOrderPaymentCollectionWorkflow } = await import(
        "@medusajs/medusa/core-flows"
      )

      const payment = container.resolve(Modules.PAYMENT) as {
        createPaymentSession: (
          collectionId: string,
          input: {
            provider_id: string
            amount: number
            currency_code: string
            context?: Record<string, unknown>
            data?: Record<string, unknown>
          }
        ) => Promise<{ id: string }>
        authorizePaymentSession: (
          id: string,
          context: Record<string, unknown>
        ) => Promise<unknown>
        capturePayment: (input: {
          payment_id: string
          amount?: number
        }) => Promise<unknown>
      }


      const { result: colecoes } = await createOrderPaymentCollectionWorkflow(
        container
      ).run({
        input: {
          order_id: String((result as any).id),
          amount: PRODUTO_E2E.precoCentavos / 100,
        },
      })

      const colecaoId = String((colecoes as any[])[0]?.id)

      const sessao = await payment.createPaymentSession(colecaoId, {
        provider_id: "pp_system_default",
        amount: PRODUTO_E2E.precoCentavos / 100,
        currency_code: "brl",
        context: { id: colecaoId },
      })

      const autorizada = (await payment.authorizePaymentSession(
        String(sessao.id),
        {}
      )) as Record<string, unknown>


      await payment.capturePayment({
        payment_id: String((autorizada as any).payment?.id ?? autorizada.id),
      })
    }

    logger.info(`[e2e] pedido ${cenario} criado`)
  }
}