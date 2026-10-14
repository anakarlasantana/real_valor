/**
 * O `/hooks/payment/:provider` do Medusa, desligado: um 404 de propósito, que
 * substitui uma rota do framework que não valida nada — pega o corpo, monta
 * `{ provider, payload }` e emite o evento, sem assinatura nem segredo.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * **Por que fechá-la.** O provider recusa todo evento que chegue sem o
 * **contexto verificado** — a assinatura é o que dá contexto ao evento (ver
 * `contexto.ts`) —, então nada legítimo se perde: o único provider sem webhook
 * é o `pp_system_default`, e os outros dois são do Mercado Pago. Já o caminho
 * de erro da rota nativa responde `400` com `err.message` no corpo, e mensagem
 * de exceção em endpoint público é divulgação de informação. Esta rota vence a
 * do framework só pela ordem de carregamento — não é contrato.
 */
/**
 * 404 indistinto: sem mensagem, sem `err.message`, sem pista — não é `405` nem
 * `403`, que diriam "esta rota existe e você não pode usá-la".
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const logger = req.scope.resolve<{ warn: (m: string) => void }>("logger")

  logger.warn(
    "[payment-hooks] chamada à rota nativa do Medusa (`/hooks/payment/:provider`) " +
      "— recusada. O webhook do Mercado Pago é `POST /webhooks/mercadopago`."
  )

  res.status(404).json({ message: "Not Found" })
}
