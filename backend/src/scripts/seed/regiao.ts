import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows";

/** Passos 3 e 4: a região Brasil e a região fiscal. Devolve o id da região. */
export async function garantirRegiao(
  container: ExecArgs["container"]
): Promise<{ regiao: string }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

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

  return { regiao: region.id };
}

