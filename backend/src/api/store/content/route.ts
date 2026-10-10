import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import { isKnownSurface, isSectionType } from "../../../modules/content/contract"
import { readChips, withFilters } from "../../../modules/content/filters"
import { readCuration, withCuration } from "../../../modules/content/curation"
import { unknownSurfaceError } from "../../../modules/content/validation"

/**
 * GET /store/content
 *
 * Seções da vitrine, prontas para render.
 *
 * Query:
 *   surface — `home` por padrão.
 *   type    — filtra por tipo (opcional). Valor inválido → 400.
 *
 * A superfície que o contrato **não declara** é 400, e não mais 200 com a lista
 * vazia: `?surface=sobreo` (o typo de sempre) devolvia `{"sections":[]}`, que a
 * loja lê como "esta página está vazia" — um endereço que não existe parecia
 * existir. Quem sabe quais superfícies existem é o contrato
 * (`CONTENT_SURFACES`), a mesma lista que a rota do CRM usa para aceitar a
 * escrita: as duas pontas de uma superfície dizem a mesma coisa.
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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

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

  if (!isKnownSurface(surface)) {
    res.status(400).json({
      type: "invalid_data",
      message: unknownSurfaceError(surface),
    })
    return
  }

  const sections = await service.listSections({
    surface,
    onlyEnabled: true,
  })
  const wanted = type ? sections.filter((section) => section.type === type) : sections
  // A curadoria entra por seção que **tem** curadoria (ver `withCuration`): sem
  // ela, o tipo que lista o catálogo sozinho continua no modo automático, e a
  // lista de produtos que a loja desenha vem da Store API de produto.
  const curation = await readCuration(
    query,
    wanted.map((section) => section.id)
  )
  // E os chips, com nome e `handle` lidos **ao vivo** da categoria
  // (`readChips`): é o que faz o chip acompanhar uma categoria renomeada no
  // painel, e é o `categoryId` que a loja usa para filtrar de verdade — não o
  // rótulo como busca, que era o defeito do chip "Blazers".
  const chips = await readChips(
    query,
    wanted.map((section) => section.id)
  )
  const { version } = await service.getContract()

  res.json({
    sections: wanted.map((section) =>
      withFilters(withCuration(section, curation[section.id]), chips[section.id])
    ),
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
