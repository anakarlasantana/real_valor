import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ambienteDaConfig, chamarSuperFrete } from "../../../../modules/fulfillment/superfrete/cliente"
import { cotarPedido, type ConfigSuperFrete } from "../../../../modules/fulfillment/superfrete/servico"
import { SERVICOS, ehServico, type Servico } from "../../../../modules/fulfillment/superfrete/catalogo"


function servicosDoPedido(valor: unknown): Servico[] {
  const pedidos = String(valor ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is Servico => ehServico(item))

  return pedidos.length > 0 ? pedidos : (Object.keys(SERVICOS) as Servico[])
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = typeof req.query.cart_id === "string" ? req.query.cart_id : ""
  const cepDestino =
    typeof req.query.postal_code === "string" ? req.query.postal_code : ""

  if (!cartId) {
    res.status(400).json({ message: "Informe o carrinho." })
    return
  }

  const cartModuleService = req.scope.resolve(Modules.CART)

  let cart: any

  try {
    cart = await cartModuleService.retrieveCart(cartId, {
      // `shipping_address`: é dele que sai o CEP de destino (sem a relação, 400).
      relations: ["items", "items.variant", "shipping_address"],
    })
  } catch {
    res.status(404).json({ message: "Carrinho não encontrado." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
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
    cepDestino: cepDestino || String(cart?.shipping_address?.postal_code ?? ""),
    itens: (cart?.items ?? []).map((item: any) => ({
      quantidade: Number(item?.quantity) || 0,
      peso_gramas: item?.variant?.weight ?? null,
    })),
    servicos: servicosDoPedido(req.query.servicos),
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    // Sem fallback: a resposta honesta é "não deu".
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
    // `rede` na primeira pergunta, `memoria`/`redis` nas seguintes: é o que
    // explica o checkout rápido no segundo render.
    origem: resultado.origem,
  })
}
