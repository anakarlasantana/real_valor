import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import { isSectionType } from "../../../modules/content/contract"

/**
 * GET /store/content
 *
 * Seções da vitrine, prontas para render.
 *
 * Query:
 *   surface — `home` por padrão.
 *   type    — filtra por tipo (opcional). Valor inválido → 400.
 *
 * Devolve apenas as seções habilitadas: conteúdo desabilitado não deve
 * nem trafegar até o navegador.
 *
 * Exige publishable API key, como toda rota `/store` — o middleware é
 * aplicado pelo próprio Medusa.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const { surface = "home", type } = req.query as {
    surface?: string
    type?: string
  }

  if (type !== undefined && !isSectionType(type)) {
    res.status(400).json({
      type: "invalid_data",
      message: `Tipo de seção desconhecido: "${type}".`,
    })
    return
  }

  const sections = await service.listSections({
    surface,
    onlyEnabled: true,
  })

  res.json({
    sections: type ? sections.filter((s) => s.type === type) : sections,
  })
}
