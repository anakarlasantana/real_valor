/**
 * Bootstrap da loja — **não** é seed de catálogo.
 * ------------------------------------------------
 * O nome do arquivo e o alvo `make seed` ficaram (o `package.json` e o
 * `Makefile` os chamam, e o README manda rodar isto para imprimir a chave do
 * storefront). O que este script faz é preparar a loja para o lojista cadastrar:
 *
 *   1. os dois canais de venda (loja online e balcão);
 *   2. a moeda da loja (BRL) e os metadados da loja;
 *   3. a região Brasil;
 *   4. a região fiscal (sem as duas a Store API não calcula preço nem frete — o
 *      storefront responde 500);
 *   5. o centro de distribuição e o vínculo com o canal de venda (todo nível de
 *      estoque é o par item × local: sem o local o lojista não lança estoque);
 *   6. o perfil e as opções de frete;
 *   7. a publishable key apontada para **um só** canal de venda, impressa no fim
 *      para o `.env` do storefront.
 *
 * **Nenhuma peça, categoria ou nível de estoque sai daqui.** Eles saíram em
 * 2026-10-08 (ver o comentário no fim do arquivo): o catálogo é do lojista, pelo
 * painel — é o caminho que a loja de verdade usa, e era o único que ninguém
 * exercitava enquanto as peças nasciam do código.
 *
 * Tudo aqui é idempotente: roda duas vezes sem duplicar canal, região, local,
 * opção de frete nem chave. Os vínculos toleram o que já existe
 * (`criarVinculo`, em `seed/`).
 */

import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { configurarCanais } from "./seed/canais";
import { imprimirChaveDoStorefront } from "./seed/chave";
import { garantirEstoque } from "./seed/estoque";
import { garantirFrete } from "./seed/frete";
import { garantirRegiao } from "./seed/regiao";

/**
 * Bootstrap da loja. O nome `seed` (do arquivo e do alvo) ficou por causa do
 * `package.json`, do `Makefile` e do README, que já o chamam assim; o que ele
 * *faz* está no comentário de topo — e não inclui catálogo.
 */
export default async function seedStoreBootstrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info(
    "[Real Valor] Preparando a loja: canais, região, nível fiscal, frete e chave..."
  );

  // Os passos do header, um arquivo cada (`seed/`), na ordem em que a loja
  // precisa deles; o que atravessa de um para o outro é o id do anterior.
  const { canalOnline } = await configurarCanais(container);
  const { regiao } = await garantirRegiao(container);
  const { local } = await garantirEstoque(container);

  await garantirFrete(container, { local, regiao, canalOnline });
  await imprimirChaveDoStorefront(container, { canalOnline });

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

