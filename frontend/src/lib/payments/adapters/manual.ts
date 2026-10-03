/**
 * O meio manual do Medusa (`pp_system_default`).
 * -------------------------------------------------------------------------
 * Ele **não processa dinheiro**: cria o pedido e deixa a captura para alguém
 * fazer fora do sistema. Serve para percorrer o checkout inteiro em teste e em
 * desenvolvimento.
 *
 * Existe como adapter porque é o único meio que **sempre** funciona — não
 * depende de credencial, de URL pública nem de provedor externo. É ele que
 * mantém a loja atravessando um ambiente onde nada mais está configurado, e o
 * que faz o checkout continuar testável depois que o Mercado Pago entrar.
 *
 * **Sem `render` e sem `Provider`.** O botão deste meio é apenas "finalizar
 * pedido", que é comum a todo meio que já autorizou — não é UI específica
 * daqui, e seria errado tratá-la como tal. O checkout desenha esse botão para
 * qualquer `fulfillment: "external"`.
 */
import { MANUAL_PROVIDER_ID } from "@rv/contrato/payment"
import type { PaymentAdapter } from "../types"

export const manualAdapter: PaymentAdapter = {
  id: MANUAL_PROVIDER_ID,
  label: "Pagamento manual",
  icon: null,
  capabilities: {
    pix: false,
    cards: false,
    boleto: false,
    interestFree: false,
  },
  /**
   * `external`: não há checkout, nem redirecionamento, nem formulário na nossa
   * página. O pedido é criado e a cobrança é tratada por fora.
   */
  fulfillment: "external",
}
