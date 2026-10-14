import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

import { criarVinculo } from "./vinculo";

/** Passo 6: o perfil de envio, as opções PAC e SEDEX e o vínculo do local. */
export async function garantirFrete(
  container: ExecArgs["container"],
  {
    local,
    regiao,
    canalOnline,
  }: { local: string; regiao: string; canalOnline: string }
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

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

  await criarVinculo(container, {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: local,
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
              region_id: regiao,
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
              region_id: regiao,
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
      id: local,
      add: [canalOnline],
    },
  });
}

