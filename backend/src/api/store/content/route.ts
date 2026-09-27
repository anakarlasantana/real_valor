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
  const { version } = await service.getSchema()

  res.json({
    sections: type ? sections.filter((s) => s.type === type) : sections,
    /**
     * A versão do schema com que estes dados foram gravados.
     *
     * A loja não usa isto para decidir o que renderizar — ela tem os tipos
     * gerados — e sim para **saber com que formulário os dados foram
     * escritos**: um `schemaVersion` diferente do que a loja conhece é o sinal
     * de que houve mudança de schema, e o que faz ela descartar um tipo que
     * não reconhece em vez de quebrar a página (ver `lib/data/content.ts`).
     */
    schemaVersion: version,
  })
}
