import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PACOTES_MODULE } from "../../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../../modules/fulfillment/pacotes/service"
import { caixaParaTela } from "../../../../modules/fulfillment/pacotes/tela"
import { invalidarCache } from "../../../../modules/fulfillment/superfrete/servico"
import { lerCaixa } from "../lib/caixa"

/** `PUT /admin/pacotes/:id` — edita. */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const id = req.params.id
  const corpo = (req.body ?? {}) as Record<string, any>

  const lido = lerCaixa(corpo)

  if (!lido.ok) {
    res.status(400).json({ message: lido.problemas.join(" "), problemas: lido.problemas })
    return
  }

  const atualizado = await pacotes.salvar({ ...lido.caixa, id })

  await invalidarCache()

  res.json({ pacote: caixaParaTela(atualizado as any) })
}

/** `DELETE` — desativa, não apaga: a etiqueta guarda o nome da caixa que usou. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const id = req.params.id

  const alvo = (await pacotes.listPacotes({ id })) as Record<string, any>[]

  if (alvo.length === 0) {
    res.status(404).json({ message: "Pacote não encontrado." })
    return
  }

  if (alvo[0].padrao) {
    res.status(409).json({
      message:
        "A caixa padrão não pode ser desativada. Marque outra como padrão antes.",
    })
    return
  }

  const desativado = await pacotes.salvar({ ...alvo[0], id, ativo: false } as any)

  await invalidarCache()

  res.json({ pacote: caixaParaTela(desativado as any) })
}
