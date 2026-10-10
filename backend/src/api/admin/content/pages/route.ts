/**
 * GET /admin/content/pages — o índice das páginas declaradas.
 * -------------------------------------------------------------------------
 * É a porta da tela "Páginas" do CRM (F3a, item 2, do doc 14): uma linha por
 * página do contrato, com o estado de hoje e as duas contagens. Ela existe
 * separada do `GET /admin/content` porque responde outra pergunta — lá é "os
 * blocos desta superfície, com o formulário de cada um"; aqui é "o que está no
 * ar", e para isso o painel precisaria de uma requisição por superfície e de
 * **contar** o que voltou, que é a decisão que não pode morar no navegador
 * (ver `scripts/check-boundaries.mjs`: a regra chega como dado).
 *
 * A régua (`publishedSections` + `pageState`) é a mesma que a rota `[slug]` do
 * storefront aplica antes do 404, e é por isso que o estado da tela vale: a
 * linha "Publicada" quer dizer que o endereço responde, e não que alguém
 * digitou "publicada".
 *
 * Serve também ao **PR7** (a página no índice público e na sugestão do 404):
 * "quais páginas estão no ar" passa a ter uma resposta só.
 *
 * Lê com `onlyEnabled: false` — como o `GET /admin/content` —, e não com o
 * filtro do banco: o que o índice mostra é justamente o que está fora do ar, e
 * uma seção despublicada precisa contar como "tem bloco, nenhum publicado".
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CONTENT_MODULE } from "../../../../modules/content"
import { PAGE_STATES, PAGE_SURFACES } from "../../../../modules/content/contract"
import { pageSummaries } from "../../../../modules/content/pages"
import type ContentModuleService from "../../../../modules/content/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ContentModuleService = req.scope.resolve(CONTENT_MODULE)

  const sectionsBySurface: Record<
    string,
    readonly { type: string; enabled: boolean }[]
  > = {}

  // Uma leitura por página declarada: são seis hoje, e cada uma precisa da lista
  // inteira (habilitadas e não). `PAGE_SURFACES`, e não uma lista escrita aqui:
  // uma página nova no contrato aparece no índice sem tocar nesta rota.
  for (const surface of PAGE_SURFACES) {
    sectionsBySurface[surface.id] = await service.listSections({
      surface: surface.id,
      onlyEnabled: false,
    })
  }

  res.json({
    pages: pageSummaries(sectionsBySurface),
    /**
     * O vocabulário dos estados, com rótulo, tom e frase — como os rótulos de
     * tipo (`typeLabels`) e o aviso da superfície (`hint`): a tela do lojista
     * desenha o que chega, e a palavra "Publicada" continua sendo a de um lugar
     * só (`PAGE_STATES`, no contrato).
     */
    pageStates: PAGE_STATES,
  })
}
