import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { PACOTES_MODULE } from "../../modules/fulfillment/pacotes";
import type PacotesModuleService from "../../modules/fulfillment/pacotes/service";

/** Passo 6a: as caixas de envio (peso e medidas) que a cotação usa. */
export async function garantirPacotes(
  container: ExecArgs["container"]
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pacotes = container.resolve<PacotesModuleService>(PACOTES_MODULE);

  const { criados } = await pacotes.restaurarPadroes();

  logger.info(
    criados > 0
      ? `[Real Valor] ${criados} caixa(s) de envio criada(s).`
      : "[Real Valor] Caixas de envio ja existem — pulando."
  );
}
