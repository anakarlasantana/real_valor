import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Fixtures do teste ponta-a-ponta — **só** a stack `rv_e2e` chama isto.
 * -------------------------------------------------------------------------
 *   yarn e2e:fixtures        (via `scripts/e2e-stack.sh up`)
 *
 * Cria o que a jornada precisa e que **não** é dado de loja:
 *
 *   1. uma peça de teste, com preço, publicada e no canal online;
 *   2. uma opção de envio de **preço fixo** — o seed só cria opções
 *      `calculated` do SuperFrete, e a jornada não pode depender de saldo na
 *      transportadora nem de rede externa.
 *
 * Idempotente: casa pelo `handle` da peça e pelo nome da opção.
 *
 * Por que no backend e não no Playwright: criar peça e opção exige os workflows
 * do Medusa (perfil de envio, zona, preço). Pela API do admin seria meia dúzia
 * de chamadas com ids intermediários — aqui é o mesmo caminho do seed.
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

  const { data: existentes } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { handle: PRODUTO_E2E.handle },
  })

  if (existentes?.length) {
    logger.info(`[e2e] peça já existe (${PRODUTO_E2E.handle}).`)
  } else {
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: PRODUTO_E2E.title,
            handle: PRODUTO_E2E.handle,
            status: "published",
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
                  { amount: PRODUTO_E2E.precoCentavos, currency_code: "brl" },
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

  const perfis = await fulfillment.listShippingProfiles({ type: "default" })

  if (!perfis.length) {
    throw new Error("Sem perfil de envio — rode `yarn seed` antes dos fixtures.")
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
            { amount: ENVIO_E2E.precoCentavos, currency_code: "brl" },
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
}
