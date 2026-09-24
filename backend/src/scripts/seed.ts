import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
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
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  logger.info("[Real Valor] Iniciando seed de dados da loja de roupas femininas...");

  const [store] = await storeModuleService.listStores();

  // 1. Canais de Venda: "Loja Online Real Valor" e "Loja Física Real Valor"
  let onlineSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Loja Online Real Valor",
  });

  if (!onlineSalesChannel.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Loja Online Real Valor",
            description: "Canal oficial do e-commerce Real Valor",
          },
          {
            name: "Loja Física Real Valor",
            description: "Canal para vendas balcão e pedidos manuais (Draft Orders)",
          },
        ],
      },
    });
    onlineSalesChannel = result;
  }

  // 2. Configurar Moeda Padrão BRL e metadados da loja
  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "brl",
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Real Valor Modas",
        default_sales_channel_id: onlineSalesChannel[0].id,
        metadata: {
          cnpj: "00.000.000/0001-00",
          whatsapp: "+55 (11) 99999-9999",
          instagram: "@realvalormodas",
          opening_hours: "Segunda a Sexta, das 09h às 18h",
        },
      },
    },
  });

  // 3. Região Brasil com Moeda BRL
  logger.info("[Real Valor] Configurando Região Brasil (BRL)...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
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
  });
  const region = regionResult[0];

  // 4. Região Fiscal Brasil
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "br",
        provider_id: "tp_system",
      },
    ],
  });

  // 5. Centro de Distribuição / Estoque
  logger.info("[Real Valor] Configurando Estoque Central...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Centro de Distribuição Real Valor",
          address: {
            city: "São Paulo",
            country_code: "BR",
            province: "SP",
            address_1: "Avenida Paulista",
            postal_code: "01310-100",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  // 6. Opções de Frete (PAC e SEDEX)
  logger.info("[Real Valor] Configurando perfis e opções de envio...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Perfil Padrão de Vestuário",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Envio Nacional Brasil",
    type: "shipping",
    service_zones: [
      {
        name: "Todo o Brasil",
        geo_zones: [
          {
            country_code: "br",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Entrega Econômica (PAC)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Econômico",
          description: "Prazo estimado de 5 a 8 dias úteis.",
          code: "economico_pac",
        },
        prices: [
          {
            currency_code: "brl",
            amount: 19.9,
          },
          {
            region_id: region.id,
            amount: 19.9,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Entrega Expressa (SEDEX)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Expresso",
          description: "Prazo estimado de 1 a 3 dias úteis.",
          code: "expresso_sedex",
        },
        prices: [
          {
            currency_code: "brl",
            amount: 34.9,
          },
          {
            region_id: region.id,
            amount: 34.9,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [onlineSalesChannel[0].id],
    },
  });

  // 7. Publishable API Key
  logger.info("[Real Valor] Configurando Publishable API Key...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
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
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [onlineSalesChannel[0].id],
    },
  });

  // 8. Categorias de Moda Feminina
  logger.info("[Real Valor] Cadastrando categorias femininas...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Vestidos",
          handle: "vestidos",
          is_active: true,
        },
        {
          name: "Blusas & Camisas",
          handle: "blusas-camisas",
          is_active: true,
        },
        {
          name: "Calças & Alfaiataria",
          handle: "calcas-alfaiataria",
          is_active: true,
        },
        {
          name: "Conjuntos",
          handle: "conjuntos",
          is_active: true,
        },
      ],
    },
  });

  // 9. Produtos de Moda Feminina Real Valor com Metadados CRO
  logger.info("[Real Valor] Cadastrando peças de moda feminina...");
  const catVestidos = categoryResult.find((c) => c.name === "Vestidos")!.id;
  const catBlusas = categoryResult.find((c) => c.name === "Blusas & Camisas")!.id;
  const catCalcas = categoryResult.find((c) => c.name === "Calças & Alfaiataria")!.id;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Vestido Midi Linho Floral",
          category_ids: [catVestidos],
          description:
            "Vestido midi confeccionado em puro linho misto com estampa floral exclusiva. Possui decote em V sutil, caimento fluido e faixa para amarração na cintura. Elegante e versátil para dias ensolarados e eventos sofisticados.",
          handle: "vestido-midi-linho-floral",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            tag_status: "Pronta Entrega",
            size_guide: [
              { size: "P", bust: "84-88 cm", waist: "66-70 cm", hip: "92-96 cm" },
              { size: "M", bust: "89-94 cm", waist: "71-76 cm", hip: "97-102 cm" },
              { size: "G", bust: "95-100 cm", waist: "77-82 cm", hip: "103-108 cm" },
              { size: "GG", bust: "101-106 cm", waist: "83-88 cm", hip: "109-114 cm" },
            ],
            composition: "70% Linho, 30% Viscose",
          },
          images: [
            {
              url: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80",
            },
          ],
          options: [
            {
              title: "Tamanho",
              values: ["P", "M", "G", "GG"],
            },
            {
              title: "Cor",
              values: ["Floral Off-White", "Floral Terracota"],
            },
          ],
          variants: [
            {
              title: "P / Floral Off-White",
              sku: "VEST-LINHO-P-OFF",
              options: {
                Tamanho: "P",
                Cor: "Floral Off-White",
              },
              prices: [{ amount: 249.9, currency_code: "brl" }],
            },
            {
              title: "M / Floral Off-White",
              sku: "VEST-LINHO-M-OFF",
              options: {
                Tamanho: "M",
                Cor: "Floral Off-White",
              },
              prices: [{ amount: 249.9, currency_code: "brl" }],
            },
            {
              title: "G / Floral Off-White",
              sku: "VEST-LINHO-G-OFF",
              options: {
                Tamanho: "G",
                Cor: "Floral Off-White",
              },
              prices: [{ amount: 249.9, currency_code: "brl" }],
            },
            {
              title: "GG / Floral Off-White",
              sku: "VEST-LINHO-GG-OFF",
              options: {
                Tamanho: "GG",
                Cor: "Floral Off-White",
              },
              prices: [{ amount: 249.9, currency_code: "brl" }],
            },
          ],
          sales_channels: [{ id: onlineSalesChannel[0].id }],
        },
        {
          title: "Camisa Feminina em Alfaiataria Seda Pura",
          category_ids: [catBlusas],
          description:
            "Camisa clássica com corte de alfaiataria fina, punhos alongados e fechamento com botões madre-pérola. Peça indispensável para composições elegantes.",
          handle: "camisa-alfaiataria-seda-pura",
          weight: 220,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            tag_status: "Pronta Entrega",
            size_guide: [
              { size: "P", bust: "86-90 cm", waist: "68-72 cm", length: "64 cm" },
              { size: "M", bust: "91-96 cm", waist: "73-78 cm", length: "66 cm" },
              { size: "G", bust: "97-102 cm", waist: "79-84 cm", length: "68 cm" },
            ],
            composition: "100% Seda",
          },
          images: [
            {
              url: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=80",
            },
          ],
          options: [
            {
              title: "Tamanho",
              values: ["P", "M", "G"],
            },
            {
              title: "Cor",
              values: ["Branco Neve", "Rosa Quartz"],
            },
          ],
          variants: [
            {
              title: "P / Branco Neve",
              sku: "CAM-SEDA-P-BR",
              options: {
                Tamanho: "P",
                Cor: "Branco Neve",
              },
              prices: [{ amount: 189.9, currency_code: "brl" }],
            },
            {
              title: "M / Branco Neve",
              sku: "CAM-SEDA-M-BR",
              options: {
                Tamanho: "M",
                Cor: "Branco Neve",
              },
              prices: [{ amount: 189.9, currency_code: "brl" }],
            },
            {
              title: "G / Branco Neve",
              sku: "CAM-SEDA-G-BR",
              options: {
                Tamanho: "G",
                Cor: "Branco Neve",
              },
              prices: [{ amount: 189.9, currency_code: "brl" }],
            },
          ],
          sales_channels: [{ id: onlineSalesChannel[0].id }],
        },
        {
          title: "Calça Pantalona Cintura Alta Alfaiataria",
          category_ids: [catCalcas],
          description:
            "Pantalona com caimento impecável e cintura alta estruturada. Bolsos frontais em faca e detalhes de pregas sutis que alongam a silhueta com extremo conforto e sofisticação.",
          handle: "calca-pantalona-cintura-alta",
          weight: 420,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            tag_status: "Pronta Entrega",
            size_guide: [
              { size: "38 (P)", waist: "68-72 cm", hip: "96-100 cm", length: "110 cm" },
              { size: "40 (M)", waist: "73-77 cm", hip: "101-105 cm", length: "112 cm" },
              { size: "42 (G)", waist: "78-83 cm", hip: "106-111 cm", length: "114 cm" },
            ],
            composition: "95% Poliéster Premium, 5% Elastano",
          },
          images: [
            {
              url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
            },
          ],
          options: [
            {
              title: "Tamanho",
              values: ["38 (P)", "40 (M)", "42 (G)"],
            },
            {
              title: "Cor",
              values: ["Preto Clássico", "Nude Areia"],
            },
          ],
          variants: [
            {
              title: "38 (P) / Preto Clássico",
              sku: "CALC-PAN-38-PR",
              options: {
                Tamanho: "38 (P)",
                Cor: "Preto Clássico",
              },
              prices: [{ amount: 219.9, currency_code: "brl" }],
            },
            {
              title: "40 (M) / Preto Clássico",
              sku: "CALC-PAN-40-PR",
              options: {
                Tamanho: "40 (M)",
                Cor: "Preto Clássico",
              },
              prices: [{ amount: 219.9, currency_code: "brl" }],
            },
            {
              title: "42 (G) / Preto Clássico",
              sku: "CALC-PAN-42-PR",
              options: {
                Tamanho: "42 (G)",
                Cor: "Preto Clássico",
              },
              prices: [{ amount: 219.9, currency_code: "brl" }],
            },
          ],
          sales_channels: [{ id: onlineSalesChannel[0].id }],
        },
      ],
    },
  });

  // 10. Atualização de estoque para os novos produtos
  logger.info("[Real Valor] Atualizando níveis de estoque...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 50,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("[Real Valor] Seed de dados concluído com sucesso!");
}
