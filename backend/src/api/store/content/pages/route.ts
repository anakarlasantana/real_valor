/**
 * GET /store/content/pages — as páginas que estão no ar.
 * -------------------------------------------------------------------------
 * É o leitor público do índice: as páginas declaradas que **respondem 200**, com
 * o rótulo e o endereço, numa chamada só. Existe porque quatro pontas da loja
 * fazem a mesma pergunta ("que páginas eu tenho para oferecer?") — o `sitemap`, a
 * coluna do rodapé (`source: "pages"`), o índice público e a sugestão do 404 —, e
 * a alternativa era cada uma varrer as seis superfícies com `GET
 * /store/content?surface=…`, sem compartilhar cache nem régua.
 *
 * A régua é a do servidor (`livePages` → `publishedSections` + `pageState`), a
 * mesma que a rota `[slug]` aplica antes de responder 404: uma página fora do ar
 * não entra em lista nenhuma. Quem lista é quem **sabe**, e o cliente não tem
 * como divergir.
 *
 * Lê com `onlyEnabled: true`: conteúdo desabilitado não deve nem trafegar, como
 * no resto da API pública. O `schemaVersion` viaja pelo mesmo motivo do
 * `/store/content` — é o registro gravado que diz com que formulário os dados
 * foram escritos, e a loja o usa para descartar o que não conhece.
 *
 * A falha de rede não é mentira: quem não receber esta resposta trata a lista
 * como vazia (a coluna do rodapé esconde, o 404 não sugere) — nunca inventa uma
 * página que pode responder 404.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CONTENT_MODULE } from "../../../../modules/content"
import { livePages, readPageSections } from "../../../../modules/content/pages"
import type ContentModuleService from "../../../../modules/content/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const sectionsBySurface = await readPageSections(service, {
    onlyEnabled: true,
  })
  const { version } = await service.getContract()

  res.json({
    pages: livePages(sectionsBySurface),
    schemaVersion: version,
  })
}
