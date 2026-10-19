import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PACOTES_MODULE } from "../../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../../modules/fulfillment/pacotes/service"
import { invalidarCache } from "../../../../modules/fulfillment/superfrete/servico"

/** `POST /admin/pacotes/restaurar` — recria as caixas de fábrica que faltarem. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const resultado = await pacotes.restaurarPadroes()

  // Só invalida se algo mudou: a tela pode chamar isto a cada abertura.
  if (Number(resultado?.criados) > 0) {
    await invalidarCache()
  }

  res.json(resultado)
}
