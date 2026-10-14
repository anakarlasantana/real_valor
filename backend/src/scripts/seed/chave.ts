import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
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

/** Passo 7: a publishable key, presa a um só canal, impressa para o `.env`. */
export async function imprimirChaveDoStorefront(
  container: ExecArgs["container"],
  { canalOnline }: { canalOnline: string }
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);

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
  const onlineChannelId = canalOnline
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
}

