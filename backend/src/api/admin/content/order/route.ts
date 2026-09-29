/**
 * POST /admin/content/order — publica a ordem da vitrine de uma vez.
 * -------------------------------------------------------------------------
 * É o "Salvar ordem" do CRM. O corpo é `{ ids: [...] }`: os ids da vitrine **na
 * ordem da tela**, sem as seções fixas (o cromo do site não tem ordem).
 *
 * A porta existe porque a alternativa era o navegador fazer o trabalho: o painel
 * mandava um `PATCH /admin/content` por seção que mudou de lugar — N
 * requisições, N gravações e N avisos à loja —, e uma falha no meio deixava a
 * vitrine com uma ordem que ninguém pediu, com a tela dizendo "salve de novo".
 * Aqui a lista chega inteira e a numeração é uma decisão só.
 *
 * A regra (o que é uma ordem válida e qual número cada casa recebe) e a
 * gravação moram em `modules/content/order.ts` (`orderErrors` + `applyOrder`).
 * Esta rota lê o corpo, decide o status e avisa a loja — **uma vez**, depois de
 * gravar, como as outras portas do conteúdo (`restore/route.ts`).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../../../modules/content"
import { applyOrder, readOrderIds } from "../../../../modules/content/order"
import { notifyStorefront } from "../../../../modules/content/revalidate"
import type ContentModuleService from "../../../../modules/content/service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const body = (req.body ?? {}) as Record<string, unknown>
  /** A superfície cuja ordem está sendo publicada (`home`, o padrão). */
  const surface = typeof body.surface === "string" ? body.surface : "home"

  const { ids, error: idsError } = readOrderIds(body.ids)

  if (idsError) {
    res.status(400).json({ type: "invalid_data", message: idsError })
    return
  }

  const { updated, error } = await applyOrder(service, {
    surface,
    ids: ids ?? [],
  })

  if (error) {
    res.status(400).json({ type: "invalid_data", message: error })
    return
  }

  // Sem mudança de posição não há o que publicar — salvar a mesma ordem duas
  // vezes não avisa a loja à toa (e a resposta diz exatamente isso: `updated`
  // vazio).
  if (updated.length) {
    notifyStorefront(req.scope)
  }

  res.json({ updated })
}
