/**
 * O webhook do Mercado Pago.
 * -------------------------------------------------------------------------
 * `POST /webhooks/mercadopago` — o endereço que vai em `MP_NOTIFICATION_URL`.
 *
 * **Por que uma rota nossa e não a nativa `POST /hooks/payment/:provider`.**
 * A rota nativa do Medusa repassa o corpo ao provider **sem validar nada**: ela
 * não conhece o Mercado Pago, não tem segredo nenhum, e o único freio entre um
 * POST anônimo e um pedido é o provider. Pior: no caminho de erro ela responde
 * `400` com `err.message` no corpo — um canal de informação para quem sonda.
 *
 * A nossa confere a assinatura HMAC antes de qualquer coisa. O corpo desta rota
 * é uma linha porque o trabalho está em `receberNotificacao`, que as duas rotas
 * (esta e a com `/pix` e `/cartao`) compartilham.
 *
 * **O `rawBody`.** O Medusa o mantém em `req.rawBody` porque a assinatura de
 * alguns provedores é sobre os bytes crus. O Mercado Pago assina um manifesto,
 * e não o corpo — então aqui ele só é repassado adiante, sem uso. Está no
 * payload porque o contrato do Medusa o espera lá.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { receberNotificacao } from "../../../modules/payment/mercadopago/webhook"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  await receberNotificacao(req, res)
}
