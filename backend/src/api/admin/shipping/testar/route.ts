import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  apenasDigitos,
  cepValido,
  type Servico,
} from "../../../../modules/fulfillment/superfrete/catalogo"
import {
  ambienteDaConfig,
  chamarSuperFrete,
} from "../../../../modules/fulfillment/superfrete/cliente"
import { PACOTES_MODULE } from "../../../../modules/fulfillment/pacotes"
import type PacotesModuleService from "../../../../modules/fulfillment/pacotes/service"
import { testarCotacao } from "../../../../modules/fulfillment/superfrete/servico"
import {
  opcoesDoServico,
  estaAtiva,
} from "../../../../modules/fulfillment/superfrete/servicos"

/** A origem vem do local de estoque, não do `.env` — a mesma da cotação do checkout. */
async function cepDoEstoque(req: MedusaRequest): Promise<string> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (
      input: Record<string, unknown>,
    ) => Promise<{ data: Record<string, any>[] }>
  }

  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "address.postal_code"],
    order: { created_at: "ASC" },
  })

  return apenasDigitos(data?.[0]?.address?.postal_code)
}

/** `POST /admin/shipping/testar` — cota sem gravar nada e sem entrar no cache. */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const corpo = (req.body ?? {}) as { cep?: string; todos?: boolean }
  const cepDestino = apenasDigitos(corpo.cep)

  if (!cepValido(cepDestino)) {
    res
      .status(400)
      .json({ message: "Informe um CEP de destino com 8 dígitos." })
    return
  }

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
      "data",
      "rules.attribute",
      "rules.value",
      "type.code",
    ],
    filters: { provider_id: "superfrete_superfrete" },
  })
  const lidas = opcoesDoServico(data ?? [])
  // `todos`: testa também as desligadas — é a única forma de saber se cotam.
  const opcoes = corpo.todos ? lidas : lidas.filter(estaAtiva)
  const servicos = opcoes
    .map((opcao) => opcao.servico)
    .filter((servico): servico is Servico => Boolean(servico))

  if (servicos.length === 0) {
    res.status(409).json({
      message: corpo.todos
        ? "Nenhuma opção de entrega diz qual serviço é. Confira as opções do SuperFrete."
        : "Nenhum serviço ativo para cotar. Ligue um serviço primeiro.",
    })
    return
  }

  // A tela mostra "ativo"/"desligado" mesmo no teste de todos.
  const ativos = new Set(
    lidas.filter(estaAtiva).map((opcao) => opcao.servico),
  )

  const pacotes = req.scope.resolve<PacotesModuleService>(PACOTES_MODULE)
  const resultado = await testarCotacao({
    config: {
      token: process.env.SUPERFRETE_TOKEN ?? "",
      ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
    },
    cepOrigem: await cepDoEstoque(req),
    cepDestino,
    caixas: await pacotes.listar(),
    servicos,
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(resultado.status).json({ message: resultado.erro })
    return
  }

  res.status(200).json({
    cotacoes: resultado.cotacoes.map((cotacao) => ({
      ...cotacao,
      ativo: ativos.has(cotacao.servico),
    })),
    // O que foi pedido e o que voltou: o que sumiu é o que não cotou.
    testados: servicos,
    pesoGramas: resultado.pesoGramas,
    ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
  })
}
