import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ambienteDaConfig, chamarSuperFrete } from "../../../../modules/fulfillment/superfrete/cliente"
import { saldoDaCarteira } from "../../../../modules/fulfillment/superfrete/etiqueta"

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const resultado = await saldoDaCarteira({
    config: {
      token: process.env.SUPERFRETE_TOKEN ?? "",
      ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
    },
    chamar: chamarSuperFrete,
  })

  if (!resultado.ok) {
    res.status(502).json({ message: resultado.mensagem })
    return
  }

  res.status(200).json({
    saldo: resultado.saldoCentavos,
    ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
  })
}
