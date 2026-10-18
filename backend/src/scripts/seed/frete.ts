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


const OPCOES = [
  { name: "PAC", servico: "PAC", label: "Econômico", description: "Entrega econômica dos Correios." },
  { name: "SEDEX", servico: "SEDEX", label: "Expresso", description: "Entrega expressa dos Correios." },
  { name: "Mini Envios", servico: "MINI", label: "Mini Envios", description: "Encomenda pequena, com prazo maior." },
] as const;

/** Passo 6b: perfil de envio, opções do SuperFrete e vínculos do local. */
export async function garantirFrete(
  container: ExecArgs["container"],
  {
    local,
    canalOnline,
  }: { local: string; regiao: string; canalOnline: string }
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("[Real Valor] Configurando perfis e opções de envio...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [{ name: "Perfil Padrão de Vestuário", type: "default" }],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  // Idempotente: `createFulfillmentSets` falha numa base já semeada.
  const { data: existingFulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id"],
    filters: { name: "Envio Nacional Brasil" },
  });

  let fulfillmentSet:
    | { id: string; service_zones: { id: string }[] }
    | undefined = existingFulfillmentSets?.[0];

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Envio Nacional Brasil",
      type: "shipping",
      service_zones: [
        { name: "Todo o Brasil", geo_zones: [{ country_code: "br", type: "country" }] },
      ],
    });
  }

  await criarVinculo(container, {
    [Modules.STOCK_LOCATION]: { stock_location_id: local },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });


  // Sem o vínculo local ↔ provider, o Medusa recusa criar a opção.
  const { data: locais } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_providers.id"],
    filters: { id: local },
  });

  const habilitados = new Set(
    (locais?.[0]?.fulfillment_providers ?? []).map((provider: any) =>
      String(provider?.id)
    )
  );

  for (const providerId of ["manual_manual", "superfrete_superfrete"]) {
    if (!habilitados.has(providerId)) {
      await criarVinculo(container, {
        [Modules.STOCK_LOCATION]: { stock_location_id: local },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
      });
    }
  }

  // `createShippingOptionsWorkflow` DUPLICA numa base já semeada.
  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "price_type"],
    filters: { shipping_profile_id: shippingProfile.id },
  });

  const opcoesExistentes = existingShippingOptions ?? [];
  const nomes = new Set(opcoesExistentes.map((o) => o.name));
  const faltando = OPCOES.filter((opcao) => !nomes.has(opcao.name));

  if (faltando.length === 0) {
    logger.info("[Real Valor] Opções de envio já existem — pulando.");
  } else {
    await createShippingOptionsWorkflow(container).run({
      input: faltando.map((opcao) => ({
        name: opcao.name,
        // `calculated` e sem `prices`: o valor vem do SuperFrete.
        price_type: "calculated" as const,
        provider_id: "superfrete_superfrete",
        service_zone_id: fulfillmentSet!.service_zones[0].id,
        shipping_profile_id: shippingProfile!.id,
        // Vai no `data`: é ele que chega ao `calculatePrice` como `optionData`.
        data: { servico: opcao.servico },
        type: {
          label: opcao.label,
          description: opcao.description,
          code: `correios_${opcao.servico.toLowerCase()}`,
        },
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
          { attribute: "is_return", value: "false", operator: "eq" as const },
        ],
      })),
    });

    logger.info(`[Real Valor] ${faltando.length} opção(ões) de envio criada(s).`);
  }

  // Desativar, e não apagar: o histórico de pedidos aponta para elas.
  const antigas = opcoesExistentes.filter(
    (opcao) => opcao.provider_id === "manual_manual" && opcao.price_type === "flat"
  );

  for (const antiga of antigas) {
    await fulfillmentModuleService.updateShippingOptions(antiga.id, {
      rules: [
        { attribute: "enabled_in_store", value: "false", operator: "eq" as const },
      ],
    } as any);
  }

  if (antigas.length > 0) {
    logger.info(
      `[Real Valor] ${antigas.length} opção(ões) de preço fixo desativada(s).`
    );
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: local, add: [canalOnline] },
  });
}
