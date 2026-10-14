import type { ExecArgs } from "@medusajs/framework/types";
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
  createSalesChannelsWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

/** O passo de moeda que o core-flows não tem: BRL, e como padrão. */
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

/** Passos 1 e 2: os canais de venda, a moeda (BRL) e a loja. Devolve o canal online. */
export async function configurarCanais(
  container: ExecArgs["container"]
): Promise<{ canalOnline: string }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeModuleService = container.resolve(Modules.STORE);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
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

  return { canalOnline: onlineSalesChannel[0].id };
}

