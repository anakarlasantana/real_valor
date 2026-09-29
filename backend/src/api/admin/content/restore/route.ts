/**
 * POST /admin/content/restore — recria as seções padrão que faltam.
 *
 * É o botão "Restaurar padrão" do CRM, e o que transforma um banco que veio
 * vazio numa loja montada. A regra (o que é "padrão", o que é "faltando" e o
 * que fazer com o que já existe) mora em `modules/content/restore.ts`, porque o
 * `make seed` faz a mesma coisa pela CLI — ver `scripts/seed-content.ts`.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../../modules/content"
import { revalidateContent } from "../../../../modules/content/revalidate"
import { restoreDefaultSections } from "../../../../modules/content/restore"
import type ContentModuleService from "../../../../modules/content/service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const { surface = "home" } = req.query as { surface?: string }

  const { created, kept } = await restoreDefaultSections(service, { surface })

  if (created.length) {
    // Sem `await`: a gravação já está feita e a resposta não espera o storefront
    // (a função não lança — ver `modules/content/revalidate.ts`).
    void revalidateContent(req.scope.resolve(ContainerRegistrationKeys.LOGGER))

    res.status(201).json({ created, kept })
    return
  }

  res.json({ created, kept })
}

