

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { caixaParaTela } from "../../../modules/fulfillment/pacotes/tela"
import { PACOTES_MODULE } from "../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../modules/fulfillment/pacotes/service"
import { lerCaixa } from "./lib/caixa"

/** `GET /admin/pacotes` — todas, a padrão primeiro. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)

  res.json({ pacotes: (await pacotes.listar()).map(caixaParaTela) })
}

/** `POST /admin/pacotes` — cria uma caixa. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const corpo = (req.body ?? {}) as Record<string, any>

  const lido = lerCaixa(corpo)

  if (!lido.ok) {
    res.status(400).json({ message: lido.problemas.join(" "), problemas: lido.problemas })
    return
  }

  const criado = await pacotes.salvar(lido.caixa)

  res.status(201).json({ pacote: caixaParaTela(criado as any) })
}
