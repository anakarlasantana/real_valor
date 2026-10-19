import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  opcoesDoServico,
  problemaDasEscolhas,
  regrasDeAtivacao,
  mudancas,
} from "../../../../modules/fulfillment/superfrete/servicos"
import { invalidarCache } from "../../../../modules/fulfillment/superfrete/servico"

const PROVIDER = "superfrete_superfrete"

async function lerOpcoes(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (
      input: Record<string, unknown>,
    ) => Promise<{ data: Record<string, any>[] }>
  }

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "price_type",
      "data",
      "rules.attribute",
      "rules.value",
      "type.code",
    ],
    filters: { provider_id: PROVIDER },
  })

  return opcoesDoServico(data ?? [])
}

/** `GET /admin/shipping/servicos` — o que a cotação oferece hoje. */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.status(200).json({ servicos: await lerOpcoes(req), provider: PROVIDER })
}

/** `PUT /admin/shipping/servicos` — liga e desliga serviços. */
export async function PUT(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const corpo = (req.body ?? {}) as {
    servicos?: { id: string; ativo: boolean }[]
  }
  const escolhas = corpo.servicos ?? []
  const atuais = await lerOpcoes(req)
  const problema = problemaDasEscolhas(escolhas, atuais)

  if (problema) {
    res.status(problema.status).json({ message: problema.mensagem })
    return
  }

  const fulfillment = req.scope.resolve(Modules.FULFILLMENT) as {
    updateShippingOptions: (
      id: string,
      data: Record<string, unknown>,
    ) => Promise<unknown>
  }
  const conhecidos = new Set(atuais.map((opcao) => opcao.id))
  const desconhecido = escolhas.find((escolha) => !conhecidos.has(escolha.id))

  if (desconhecido) {
    res.status(404).json({
      message: `A opção de envio ${desconhecido.id} não é do SuperFrete.`,
    })
    return
  }

  const mudar = mudancas(atuais, escolhas)

  for (const mudanca of mudar) {
    await fulfillment.updateShippingOptions(mudanca.id, {
      rules: regrasDeAtivacao(mudanca.ativa),
    })
  }

  // Ligar/desligar não mexe no preço, mas o teste do admin e a tela leem a
  // lista guardada; só invalida quando algo mudou de fato.
  if (mudar.length > 0) {
    await invalidarCache()
  }

  res
    .status(200)
    .json({ servicos: await lerOpcoes(req), alterados: mudar.length })
}
