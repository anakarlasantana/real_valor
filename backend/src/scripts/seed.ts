/**
 * Bootstrap da loja — **não** é seed de catálogo.
 * ------------------------------------------------
 * O nome do arquivo e o alvo `make seed` ficaram (o `package.json` e o
 * `Makefile` os chamam, e o README manda rodar isto para imprimir a chave do
 * storefront). O que este script faz é preparar a loja para o lojista cadastrar:
 *
 *   1. os dois canais de venda (loja online e balcão);
 *   2. a moeda da loja (BRL);
 *   3. a região Brasil com a região fiscal (sem elas a Store API não calcula
 *      preço nem frete — o storefront responde 500);
 *   4. o centro de distribuição e o vínculo com o canal de venda (todo nível de
 *      estoque é o par item × local: sem o local o lojista não lança estoque);
 *   5. o perfil e as opções de frete;
 *   6. a publishable key apontada para **um só** canal de venda, impressa no fim
 *      para o `.env` do storefront.
 *
 * **Nenhuma peça, categoria ou nível de estoque sai daqui.** Eles saíram em
 * 2026-10-08 (ver o comentário no fim do arquivo): o catálogo é do lojista, pelo
 * painel — é o caminho que a loja de verdade usa, e era o único que ninguém
 * exercitava enquanto as peças nasciam do código.
 *
 * Tudo aqui é idempotente: roda duas vezes sem duplicar canal, região, local,
 * opção de frete nem chave. Os vínculos toleram o que já existe (`linkOnce`,
 * abaixo).
 */
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
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
} from "@medusajs/medusa/core-flows";
/**
 * A chave de API que o seed lê: `id` e `token` — os dois campos pedidos no
 * `graph` e os dois que o código usa (`token` sai impresso no fim).
 *
 * O tipo é local e mínimo de propósito, e isso foi medido: cada alternativa
 * quebra num dos estados. O `ApiKey` de `.medusa/types/query-entry-points` é
 * GERADO pelo `medusa build` e está no `.gitignore` — num clone limpo o arquivo
 * não existe e o `tsc` reprovava aqui com TS2307 (era a causa do job `tipos` da
 * CI). O `ApiKeyDTO` do framework resolve o clone, mas **no host**, onde o
 * diretório gerado existe e a augmentação tipa o `graph`, a atribuição de
 * `data?.[0]` reprova: `last_used_at` é `Maybe<string | Date>` no gráfico e
 * `Date | null` no DTO (TS2322 medido). Só um tipo que declara o que se lê —
 * dois campos de texto — passa nos dois estados.
 */
type PublishableApiKey = { id: string; token: string }

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

/**
 * Bootstrap da loja. O nome `seed` (do arquivo e do alvo) ficou por causa do
 * `package.json`, do `Makefile` e do README, que já o chamam assim; o que ele
 * *faz* está no comentário de topo — e não inclui catálogo.
 */
export default async function seedStoreBootstrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  logger.info(
    "[Real Valor] Preparando a loja: canais, região, nível fiscal, frete e chave..."
  );

  /**
   * Cria o vínculo, tolerando o que já existe.
   *
   * `link.create` falha com "Cannot create multiple links between ...", ou seja,
   * o seed só rodava numa base vazia — e o README manda rodar `make seed`
   * justamente para imprimir a chave do storefront, ou seja, ele precisa poder
   * rodar duas vezes. Vínculo repetido é o estado desejado; qualquer outro erro
   * sobe.
   */
  const linkOnce = async (data: Parameters<typeof link.create>[0]) => {
    try {
      await link.create(data)
    } catch (error) {
      const message = String((error as Error)?.message ?? error)

      if (!/multiple links/i.test(message)) {
        throw error
      }
    }
  };

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
  // Idempotente: a região que já existe é reutilizada. Sem esta checagem o
  // seed morre em `Countries with codes: "br" are already assigned to a region`
  // assim que a base já foi semeada — e o README manda rodar `make seed` para
  // imprimir a chave do storefront, ou seja, o seed precisa rodar duas vezes
  // sem quebrar. Só o `id` é usado daqui para frente (stock location e
  // fulfilment set), então a busca enxuta serve.
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { currency_code: "brl" },
  })

  // Só o `id` interessa daqui para frente; o tipo é o mínimo comum entre o
  // que o `query` devolve (DTO) e o que o workflow cria (entidade).
  let region: { id: string } | undefined = existingRegions?.[0]

  if (!region) {
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
    })

    region = regionResult[0]
  }

  // 4. Região Fiscal Brasil
  // Idempotente pelo mesmo motivo da região: `createTaxRegionsWorkflow` falha
  // com "Tax region with country_code: br, already exists" se ela já existir.
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: "br" },
  })

  if (!existingTaxRegions?.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "br",
          provider_id: "tp_system",
        },
      ],
    })
  }

  // 5. Centro de Distribuição / Estoque
  logger.info("[Real Valor] Configurando Estoque Central...");
  // Idempotente, e a consequência é séria. `createStockLocationsWorkflow` não
  // falha numa base já semeada: ele **cria outro local**. Medido nesta base: 8
  // locais e 81 níveis de estoque, de 10 SKUs. E o efeito não era só sujeira —
  // a `inventory_quantity` que a loja mostrava era a **soma dos 8 locais**, então
  // uma peça com 50 reais virava "400" na vitrine. Um número de estoque
  // inflado por seed é pior do que nenhum: a loja acredita que pode vender 400
  // e descobre na reserva (RV-042) que tinha 50.
  const { data: existingStockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Centro de Distribuição Real Valor" },
  })

  let stockLocation: { id: string }

  if (existingStockLocations?.length) {
    stockLocation = existingStockLocations[0]
    logger.info(
      "[Real Valor] Centro de Distribuicao ja existe — reaproveitando."
    )
  } else {
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
    })

    stockLocation = stockLocationResult[0]
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await linkOnce({
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

  // Idempotente pelo mesmo motivo: `createFulfillmentSets` falha com
  // "Fulfillment set with name: ..., already exists" numa base já semeada. O
  // `service_zones.id` é usado pelas opções de frete abaixo, então a busca
  // precisa trazer as zonas, não só o id.
  const { data: existingFulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id"],
    filters: { name: "Envio Nacional Brasil" },
  })

  // Tipo mínimo: o `id` e o `service_zones[].id` das opções de frete.
  let fulfillmentSet:
    | { id: string; service_zones: { id: string }[] }
    | undefined = existingFulfillmentSets?.[0]

  if (!fulfillmentSet) {
    fulfillmentSet =
      await fulfillmentModuleService.createFulfillmentSets({
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
      })
  }

  await linkOnce({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  // Idempotente, pelo mesmo motivo dos produtos: `createShippingOptionsWorkflow`
  // não falha numa base já semeada — ele **duplica**. Cada `make seed` somava
  // mais um PAC e mais um SEDEX, e o cliente via a lista de frete da loja com
  // "Entrega Econômica (PAC)" repetida sete vezes, indistinguível, com o mesmo
  // preço. Não dá erro, não quebra o checkout, e não aparece em nenhum log:
  // a loja simplesmente mostra a mesma opção várias vezes.
  //
  // A chave é o par (nome, perfil de envio) do serviço de fulfillment, e não o
  // id — o id muda a cada execução, então comparar por ele não encontraria a
  // opção da rodada anterior.
  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "shipping_profile_id"],
    filters: { shipping_profile_id: shippingProfile.id },
  })

  const opcoesExistentes = new Set(
    (existingShippingOptions ?? []).map((o) => o.name)
  )

  if (
    opcoesExistentes.has("Entrega Econômica (PAC)") &&
    opcoesExistentes.has("Entrega Expressa (SEDEX)")
  ) {
    logger.info(
      "[Real Valor] Opcoes de envio ja existem (PAC e SEDEX) — pulando."
    )
  } else {
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
    })
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [onlineSalesChannel[0].id],
    },
  });

  // 7. Publishable API Key
  logger.info("[Real Valor] Configurando Publishable API Key...");
  let publishableApiKey: PublishableApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    // `token` junto: o seed imprime a chave no fim (ver abaixo), e é ela que o
    // storefront precisa em `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. Sem isso a
    // única forma de descobrir a chave é abrir o painel.
    fields: ["id", "token"],
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

    publishableApiKey = publishableApiKeyResult
  }

  // A chave fica presa a **um só** canal de venda. O `add` sozinho nunca desliga
  // o vínculo que o bootstrap do Medusa deixou ("Default Sales Channel"), e com
  // dois canais o `/store/products` recusa calcular inventário — "Inventory
  // availability cannot be calculated in the given context" — e a página de
  // produto responde 500. O `remove` dos demais é o que corrige.
  const onlineChannelId = onlineSalesChannel[0].id
  const otherChannelIds = (
    await salesChannelModuleService.listSalesChannels()
  )
    .map((channel) => channel.id)
    .filter((id) => id !== onlineChannelId)

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [onlineChannelId],
      ...(otherChannelIds.length ? { remove: otherChannelIds } : {}),
    },
  })

  // A chave é pública por desenho (ela vai no bundle do navegador), então
  // imprimi-la é seguro — e evita o `.env` ficar com a chave de um banco
  // antigo, que é como o storefront passou a responder 400 "A valid publishable
  // key is required" depois de um `clean-db`.
  logger.info(
    `[Real Valor] Chave do storefront (\`.env\`): ` +
      `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${publishableApiKey.token}`
  );

  /**
   * Aqui terminava o seed de catálogo: quatro categorias, três peças com
   * variantes e `stocked_quantity: 50` para cada item de inventário. Ele saiu
   * por inteiro, e o motivo não é economia de linhas.
   *
   * 1. **Era a única origem das peças.** Com o catálogo nascendo do código, a
   *    vitrine só existia depois de `make seed` — e o caminho real, cadastrar
   *    pelo painel, nunca era exercitado. Quem seguisse o roteiro deste repo
   *    abria uma loja que o lojista não tinha como reproduzir nem manter.
   * 2. **O estoque do seed mentia.** `stocked_quantity: 50` para todo item fazia
   *    toda peça nascer em estoque, com o botão de comprar ligado, em cima de
   *    uma quantidade que ninguém contou.
   * 3. **O que sobra não é catálogo de demonstração.** Os passos 1 a 7 são
   *    pré-requisito de a loja funcionar: sem região e região fiscal a Store API
   *    não calcula preço nem frete; sem centro de distribuição o lojista não
   *    consegue lançar estoque (todo nível é o par item × local); sem a
   *    publishable key o storefront responde 400. Por isso o alvo `make seed`
   *    continua existindo — fazendo só isso, e o texto dele passa a dizer isso.
   *
   * A consequência está escrita onde importa: a vitrine nasce **vazia**, com os
   * estados vazios das seções (ver `docs/real-valor/12-script-enriquecimento-catalogo.md`).
   * O `seed-content.ts` não mudou uma linha: ele não cita produto em lugar
   * nenhum (medido), então nada aqui o alcança.
   */
  logger.info(
    "[Real Valor] Loja preparada: canais, região, frete e chave. " +
      "O catálogo é do lojista — cadastre a primeira peça no painel."
  )
}
