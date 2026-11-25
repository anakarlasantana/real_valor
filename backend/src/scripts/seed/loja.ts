import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

import { PACOTES_MODULE } from "../../modules/fulfillment/pacotes"
import { PACOTES_PADRAO } from "../../modules/fulfillment/pacotes/defaults"
import type PacotesModuleService from "../../modules/fulfillment/pacotes/service"
import { criarVinculo } from "./vinculo"

/**
 * O mínimo para a loja funcionar — e nada além disso.
 *
 * O que é decisão do lojista (produto, categoria, coleção, página, preço de
 * frete, CNPJ, identidade da marca) nasce no painel. Aqui nasce só a
 * infraestrutura sem a qual o painel não tem o que editar.
 */

/** O canal do storefront. Um só: a chave pública é presa a ele. */
export const CANAL_ONLINE = "Loja Online Real Valor"

/** A origem da cotação: `from_location.address.postal_code` (SuperFrete). */
export const ENDERECO_ORIGEM = {
  address_1: "Rua Luís Costa Filho",
  address_2: "388",
  city: "Fortaleza",
  province: "CE",
  postal_code: "60352-680",
  country_code: "BR",
  phone: "8530000000",
  // O bairro e' o que a etiqueta imprime; sem ele o SuperFrete recusa o
  // remetente, e o fallback do codigo usaria a UF (dado errado no papel).
  metadata: { bairro: "Quintino Cunha" },
} as const

/** Os três serviços que nascem ligados; Jadlog, J&T e Loggi são escolha do lojista. */
export const SERVICOS_MINIMOS = [
  { name: "PAC", servico: "PAC", tipo: "correios_pac", label: "Econômico", description: "Entrega econômica dos Correios." },
  { name: "SEDEX", servico: "SEDEX", tipo: "correios_sedex", label: "Expresso", description: "Entrega expressa dos Correios." },
  { name: "Mini Envios", servico: "MINI", tipo: "correios_mini", label: "Mini Envios", description: "Encomenda pequena, com prazo maior." },
] as const

/** A caixa que a cotação usa. As outras cinco ficam no "Restaurar padrões" do CRM. */
export const PACOTE_PADRAO = PACOTES_PADRAO.find((pacote) => pacote.padrao)!

/** O passo de moeda que o core-flows não tem: BRL, e como padrão. */
const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => ({
              currency_code: currency.currency_code,
              is_default: currency.is_default ?? false,
            })
          ),
        },
      }
    })

    return new WorkflowResponse(updateStoresStep(normalizedInput))
  }
)

type Container = ExecArgs["container"]

/** Passo 1: canal de venda, moeda BRL e o canal padrão da loja. */
async function prepararCanal(container: Container): Promise<string> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const storeModuleService = container.resolve(Modules.STORE)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const [store] = await storeModuleService.listStores()

  let canais = await salesChannelModuleService.listSalesChannels({
    name: CANAL_ONLINE,
  })

  if (!canais.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: CANAL_ONLINE,
            description: "Canal oficial do e-commerce Real Valor",
          },
        ],
      },
    })

    canais = result
  }

  const canalOnline = canais[0].id

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [{ currency_code: "brl", is_default: true }],
    },
  })

  // Só o canal padrão: nome, CNPJ, WhatsApp e horário são do lojista, e é em
  // Configurações que ele edita — o seed não inventa identidade de negócio.
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: canalOnline },
    },
  })

  logger.info("[Real Valor] canal e moeda (BRL) prontos.")
  return canalOnline
}

/** Passo 2: região Brasil e a região fiscal — sem elas a API não precifica. */
async function prepararRegiao(container: Container): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regioes } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { currency_code: "brl" },
  })

  if (!regioes?.length) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Brasil",
            currency_code: "brl",
            countries: ["br"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
  }

  const { data: fiscais } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: "br" },
  })

  if (!fiscais?.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "br", provider_id: "tp_system" }],
    })
  }

  logger.info("[Real Valor] região Brasil e região fiscal prontas.")
}

/** Passo 3: centro de distribuição — é dele que sai o CEP de origem. */
async function prepararLocal(container: Container): Promise<string> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModuleService = container.resolve(Modules.STORE)
  const [store] = await storeModuleService.listStores()

  const { data: existentes } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Centro de Distribuição Real Valor" },
  })

  let local: { id: string }

  if (existentes?.length) {
    local = existentes[0]
    logger.info("[Real Valor] centro de distribuição já existe — reaproveitando.")
  } else {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Centro de Distribuição Real Valor",
            address: { ...ENDERECO_ORIGEM },
          },
        ],
      },
    })

    local = result[0]
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: local.id },
    },
  })

  await criarVinculo(container, {
    [Modules.STOCK_LOCATION]: { stock_location_id: local.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  return local.id
}

/** Passo 4: a caixa padrão. Sem caixa ativa a cotação recusa o pedido. */
async function prepararCaixa(container: Container): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pacotes = container.resolve<PacotesModuleService>(PACOTES_MODULE)
  const existentes = await pacotes.listPacotes()

  if (existentes.some((pacote) => pacote.padrao)) {
    logger.info("[Real Valor] caixa padrão já existe — pulando.")
    return
  }

  await pacotes.createPacotes([{ ...PACOTE_PADRAO, padrao: true }])

  logger.info(`[Real Valor] caixa padrão criada (${PACOTE_PADRAO.nome}).`)
}

/** Passo 5: perfil, zona e as três opções de envio do SuperFrete. */
async function prepararFrete(
  container: Container,
  { local, canalOnline }: { local: string; canalOnline: string }
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const perfis = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })

  const perfil =
    perfis[0] ??
    (
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [{ name: "Perfil Padrão de Vestuário", type: "default" }],
        },
      })
    ).result[0]

  const { data: sets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id"],
    filters: { name: "Envio Nacional Brasil" },
  })

  const set =
    sets?.[0] ??
    (await fulfillmentModuleService.createFulfillmentSets({
      name: "Envio Nacional Brasil",
      type: "shipping",
      service_zones: [
        {
          name: "Todo o Brasil",
          geo_zones: [{ country_code: "br", type: "country" }],
        },
      ],
    }))

  await criarVinculo(container, {
    [Modules.STOCK_LOCATION]: { stock_location_id: local },
    [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
  })

  // Sem o vínculo local ↔ provider o Medusa recusa criar a opção.
  const { data: locais } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id"],
    filters: { id: local },
  })

  const habilitados = new Set(
    (locais?.[0]?.fulfillment_providers ?? []).map((provider: any) =>
      String(provider?.id)
    )
  )

  for (const providerId of ["manual_manual", "superfrete_superfrete"]) {
    if (!habilitados.has(providerId)) {
      await criarVinculo(container, {
        [Modules.STOCK_LOCATION]: { stock_location_id: local },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
      })
    }
  }

  const { data: existentes } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "price_type", "rules", "data"],
    filters: { shipping_profile_id: perfil.id },
  })

  const opcoes = existentes ?? []
  // Casa pelo serviço, não pelo nome: o nome é editável na tela do admin.
  const servicos = new Set(
    opcoes.map((opcao) => String((opcao.data as any)?.servico ?? ""))
  )
  const faltando = SERVICOS_MINIMOS.filter(
    (opcao) => !servicos.has(opcao.servico)
  )

  if (faltando.length) {
    await createShippingOptionsWorkflow(container).run({
      input: faltando.map((opcao) => ({
        name: opcao.name,
        // `calculated` e sem `prices`: o valor vem do SuperFrete.
        price_type: "calculated" as const,
        provider_id: "superfrete_superfrete",
        service_zone_id: set.service_zones[0].id,
        shipping_profile_id: perfil.id,
        data: { servico: opcao.servico },
        type: {
          label: opcao.label,
          description: opcao.description,
          code: opcao.tipo,
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq" as const,
          },
          { attribute: "is_return", value: "false", operator: "eq" as const },
        ],
      })),
    })
  }

  logger.info(
    `[Real Valor] envio: ${faltando.length} opção(ões) criada(s), ` +
      `${SERVICOS_MINIMOS.length - faltando.length} já existia(m).`
  )

  // Desativar, e não apagar: o histórico de pedidos aponta para elas.
  const antigas = opcoes.filter(
    (opcao) =>
      opcao.provider_id === "manual_manual" && opcao.price_type === "flat"
  )

  for (const antiga of antigas) {
    await fulfillmentModuleService.updateShippingOptions(antiga.id, {
      rules: [
        {
          attribute: "enabled_in_store",
          value: "false",
          operator: "eq" as const,
        },
      ],
    } as any)
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: local, add: [canalOnline] },
  })
}

/** Passo 6: a publishable key, presa a um só canal, impressa para o `.env`. */
async function prepararChave(
  container: Container,
  { canalOnline }: { canalOnline: string }
): Promise<string> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  })

  let chave: { id: string; token: string } | undefined = data?.[0]

  if (!chave) {
    const {
      result: [criada],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Storefront Real Valor",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })

    chave = criada
  }

  // A chave fica presa a **um só** canal: com dois, o `/store/products` recusa
  // calcular inventário e a página de produto responde 500. O `add` sozinho não
  // desliga o vínculo que o bootstrap do Medusa deixou.
  const outros = (await salesChannelModuleService.listSalesChannels())
    .map((canal) => canal.id)
    .filter((id) => id !== canalOnline)

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: chave.id,
      add: [canalOnline],
      ...(outros.length ? { remove: outros } : {}),
    },
  })

  logger.info(
    `[Real Valor] chave do storefront: ` +
      `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${chave.token}`
  )

  return chave.token
}

/** Os passos 1 a 6, na ordem em que a loja precisa deles. */
export async function prepararLoja(container: Container): Promise<void> {
  const canalOnline = await prepararCanal(container)

  await prepararRegiao(container)
  const local = await prepararLocal(container)
  await prepararCaixa(container)
  await prepararFrete(container, { local, canalOnline })
  await prepararChave(container, { canalOnline })
}




