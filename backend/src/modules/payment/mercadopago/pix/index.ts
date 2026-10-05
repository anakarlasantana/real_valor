import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { MercadoPagoProvider } from "../service"
import { METODOS } from "../preferencia"

/**
 * O registro do provider de **Pix**.
 * -------------------------------------------------------------------------
 * **Por que um módulo por meio, e não um módulo com dois services.** Porque o
 * `id` do registro é o que separa os dois. O loader do módulo de pagamento
 * monta a chave como `` `pp_${identifier}${id ? `_${id}` : ""}` `` e o `id` vem
 * do **item da lista em `medusa-config.ts`**, não do service. Dois services no
 * mesmo `ModuleProvider` receberiam o **mesmo** `id` — e o segundo registro
 * sobrescreveria o primeiro, deixando a loja com um meio só, sem erro nenhum.
 *
 * Com um módulo por meio, cada um declara o seu `id` (`pix` / `cartao`) e os
 * dois coexistem como `pp_mercadopago_pix` e `pp_mercadopago_cartao`. É a mesma
 * forma do `@medusajs/medusa/fulfillment-manual`, e o
 * `registro.unit.spec.ts` prende os dois lados — o config **e** o registry do
 * storefront.
 *
 * **Por que `metodo` é uma propriedade e não um parâmetro.** O Medusa
 * instancia o provider sozinho (`new klass(cradle, options)`), então o que
 * distingue um do outro tem de estar na **classe**, não na chamada. É por isso
 * que a subclasse existe: `MercadoPagoProvider` tem o comportamento, e
 * `MercadoPagoPixService` tem a identidade.
 */
export class MercadoPagoPixService extends MercadoPagoProvider {
  static metodo = "pix" as const

  static identifier = "mercadopago"
}

/** O `provider_id` que este registro produz. Preso por teste, não por memória. */
export const PROVIDER_ID = METODOS.pix.providerId

export default ModuleProvider(Modules.PAYMENT, {
  services: [MercadoPagoPixService],
})
