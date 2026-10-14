/** O `link` do container e o mapa de módulos: os dois lados de um vínculo. */
import type { ExecArgs, LinkDefinition } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Cria o vínculo, tolerando o que já existe.
 *
 * `link.create` falha com "Cannot create multiple links between ...", ou seja,
 * o seed só rodava numa base vazia — e o README manda rodar `make seed`
 * justamente para imprimir a chave do storefront, ou seja, ele precisa poder
 * rodar duas vezes. Vínculo repetido é o estado desejado; qualquer outro erro
 * sobe.
 */
export async function criarVinculo(
  container: ExecArgs["container"],
  dados: LinkDefinition
): Promise<void> {
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  try {
    await link.create(dados)
  } catch (error) {
    const message = String((error as Error)?.message ?? error)

    if (!/multiple links/i.test(message)) {
      throw error
    }
  }
}
