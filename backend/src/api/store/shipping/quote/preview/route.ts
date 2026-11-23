import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  ambienteDaConfig,
  chamarSuperFrete,
} from "../../../../../modules/fulfillment/superfrete/cliente"
import {
  cotarPedido,
  type ConfigSuperFrete,
} from "../../../../../modules/fulfillment/superfrete/servico"
import {
  SERVICOS,
  ehServico,
  type Servico,
} from "../../../../../modules/fulfillment/superfrete/catalogo"

function servicosDoPedido(valor: unknown): Servico[] {
  const pedidos = String(valor ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is Servico => ehServico(item))

  return pedidos.length > 0 ? pedidos : (Object.keys(SERVICOS) as Servico[])
}

function cepDe(valor: unknown): string {
  const digitos = String(valor ?? "").replace(/\D/g, "")

  return digitos.length === 8 ? digitos : ""
}

function quantidadeDe(valor: unknown): number {
  const quantidade = Math.floor(Number(valor ?? 1))

  return Number.isFinite(quantidade) && quantidade >= 1 && quantidade <= 99
    ? quantidade
    : 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cepDestino = cepDe(req.query.postal_code)

  if (!cepDestino) {
    res.status(400).json({ message: "Informe um CEP de destino válido." })
    return
  }

  const variantId =
    typeof req.query.variant_id === "string" ? req.query.variant_id.trim() : ""

  if (!variantId) {
    res.status(400).json({ message: "Informe a variação da peça." })
    return
  }

  const quantidade = quantidadeDe(req.query.quantity)

  if (!quantidade) {
    res.status(400).json({ message: "Informe uma quantidade entre 1 e 99." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>
  }

  const { data: variantes } = await query.graph({
    entity: "variant",
    fields: ["id", "weight"],
    filters: { id: variantId },
  })

  const variante = (variantes ?? [])[0]

  if (!variante) {
    res.status(404).json({ message: "Variação não encontrada." })
    return
  }

  const { data: locais } = await query.graph({
    entity: "stock_location",
    fields: ["id", "address.postal_code"],
  })

  const cepOrigem = String(locais?.[0]?.address?.postal_code ?? "")

  const config: ConfigSuperFrete = {
    token: process.env.SUPERFRETE_TOKEN ?? "",
    ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
  }

  const resultado = await cotarPedido({
    container: req.scope as any,
    config,
    cepOrigem,
    cepDestino,
    itens: [{ quantidade, peso_gramas: variante.weight ?? null }],
    servicos: servicosDoPedido(req.query.servicos),
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(resultado.status).json({
      message: resultado.erro,
      origem: resultado.origem,
    })
    return
  }

  res.json({
    cotacoes: resultado.cotacoes,
    volumes: resultado.volumes,
    peso_gramas: resultado.pesoGramas,
    origem: resultado.origem,
  })
}
