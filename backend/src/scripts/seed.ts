/**
 * Bootstrap da loja — **não** é seed de catálogo: deixa a loja pronta para o
 * lojista cadastrar, e é idempotente (rodar duas vezes não duplica nada).
 */

import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { configurarCanais } from "./seed/canais";
import { imprimirChaveDoStorefront } from "./seed/chave";
import { garantirEstoque } from "./seed/estoque";
import { garantirFrete } from "./seed/frete";
import { garantirRegiao } from "./seed/regiao";

/**
 * Os passos, na ordem em que a loja precisa deles, um arquivo cada em `seed/`:
 * canais de venda, moeda e metadados, região Brasil, região fiscal (sem as duas
 * a Store API não calcula preço nem frete — o storefront responde 500), centro
 * de distribuição e vínculo ao canal (todo nível de estoque é o par item ×
 * local), frete e a publishable key de **um só** canal, impressa no fim para o
 * `.env` do storefront. O que atravessa de um passo ao outro é o id do anterior,
 * e os vínculos toleram o que já existe (`criarVinculo`, em `seed/`).
 *
 * **Nenhuma peça, categoria ou nível de estoque sai daqui**: o catálogo é do
 * lojista, pelo painel.
 */
export default async function seedStoreBootstrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info(
    "[Real Valor] Preparando a loja: canais, região, nível fiscal, frete e chave..."
  );

  const { canalOnline } = await configurarCanais(container);
  const { regiao } = await garantirRegiao(container);
  const { local } = await garantirEstoque(container);

  await garantirFrete(container, { local, regiao, canalOnline });
  await imprimirChaveDoStorefront(container, { canalOnline });

  // Aqui terminava o seed de catálogo — categorias, peças com variantes e
  // `stocked_quantity: 50` em todo item. Ele saiu porque era a **única** origem
  // das peças (a vitrine só existia depois de `make seed`, e cadastrar pelo
  // painel — o caminho real — nunca era exercitado) e porque o estoque mentia:
  // toda peça nascia em estoque, com o botão de comprar ligado, sobre uma
  // quantidade que ninguém contou. A vitrine agora nasce **vazia**.
  logger.info(
    "[Real Valor] Loja preparada: canais, região, frete e chave. " +
      "O catálogo é do lojista — cadastre a primeira peça no painel."
  )
}

