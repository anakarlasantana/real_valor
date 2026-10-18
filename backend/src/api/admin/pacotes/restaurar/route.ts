import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PACOTES_MODULE } from "../../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../../modules/fulfillment/pacotes/service"

/** `POST /admin/pacotes/restaurar` — recria as caixas de fábrica que faltarem. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)

  res.json(await pacotes.restaurarPadroes())
}
