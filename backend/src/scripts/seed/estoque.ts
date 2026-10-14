import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createStockLocationsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

import { criarVinculo } from "./vinculo";

/** Passo 5: o centro de distribuição e o local padrão. Devolve o id do local. */
export async function garantirEstoque(
  container: ExecArgs["container"]
): Promise<{ local: string }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeModuleService = container.resolve(Modules.STORE);
  const [store] = await storeModuleService.listStores();

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

  await criarVinculo(container, {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  return { local: stockLocation.id };
}

