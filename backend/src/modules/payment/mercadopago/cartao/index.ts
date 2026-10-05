import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { MercadoPagoProvider } from "../service"
import { METODOS } from "../preferencia"

/**
 * O registro do provider de **cartão de crédito**.
 * -------------------------------------------------------------------------
 * O irmão de `../pix`, e a leitura completa do porquê de serem dois módulos
 * está lá. O que muda entre os dois está em `METODOS`, em `../preferencia`:
 * meios excluídos e limite de parcelas. Nada de comportamento diverge — de
 * propósito, porque dois caminhos de pagamento que divergem no código divergem
 * na conciliação, e ninguém descobre qual dos dois errou.
 *
 * **O mesmo `identifier` nos dois é correto.** Ele é o nome do provedor
 * (`mercadopago`), e é o `id` do registro que os separa. Trocar o `identifier`
 * para `mercadopago_cartao` produziria `pp_mercadopago_cartao_cartao` — e um
 * provider que ninguém acha.
 */
export class MercadoPagoCartaoService extends MercadoPagoProvider {
  static metodo = "cartao" as const

  static identifier = "mercadopago"
}

/** O `provider_id` que este registro produz. Preso por teste, não por memória. */
export const PROVIDER_ID = METODOS.cartao.providerId

export default ModuleProvider(Modules.PAYMENT, {
  services: [MercadoPagoCartaoService],
})
