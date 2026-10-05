/**
 * O webhook do Mercado Pago, com o meio no caminho.
 * -------------------------------------------------------------------------
 * `POST /webhooks/mercadopago/pix` e `POST /webhooks/mercadopago/cartao`.
 *
 * **Por que as duas URLs existem.** A preferência anuncia
 * `MP_NOTIFICATION_URL`, uma só — então as duas rotas fazem o mesmo trabalho, e
 * o sufixo é **apenas uma dica de log**. Quem decide o meio é o `provider_id` da
 * sessão gravada, não o caminho.
 *
 * Isso é deliberado, e é a diferença entre uma fronteira e uma conveniência:
 * quem envia controla a URL, e uma decisão que depende dela seria uma decisão do
 * remetente. O caminho serve para a divergência aparecer no log quando alguém
 * configura a URL errada no painel do Mercado Pago — que é o erro provável na
 * primeira configuração, e o mais difícil de ver sem uma pista.
 *
 * **Um sufixo desconhecido é 404**, e não 200: uma URL com erro de digitação
 * precisa aparecer como erro no painel de webhooks do provedor, onde alguém vai
 * olhar. Engolir com 200 esconderia a configuração errada até a primeira venda
 * que não virou pedido.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  TODOS_OS_METODOS,
  type Metodo,
} from "../../../../modules/payment/mercadopago/preferencia"
import { receberNotificacao } from "../../../../modules/payment/mercadopago/webhook"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const sufixo = String((req.params as { metodo?: string })?.metodo ?? "").toLowerCase()

  if (!TODOS_OS_METODOS.includes(sufixo as Metodo)) {
    res.status(404).json({ message: "Not Found" })
    return
  }

  await receberNotificacao(req, res, sufixo as Metodo)
}
