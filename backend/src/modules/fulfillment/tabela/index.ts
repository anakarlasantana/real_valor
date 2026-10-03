import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import TabelaFulfillmentService from "./service"

/**
 * O registro do provider de frete "tabela".
 * -------------------------------------------------------------------------
 * A forma é a do `@medusajs/fulfillment-manual`: um `ModuleProvider` do
 * módulo de FULFILLMENT com a lista de services. É o **único** lugar onde um
 * método de frete precisa serplugado no Medusa — e é por isso que trocar de
 * transportadora depois é uma linha aqui, mais um service.
 *
 * O identificador (`TabelaFulfillmentService.identifier = "tabela"`) é o que o
 * Admin mostra no seletor de provider da shipping option. O `seed.ts` usa
 * `manual_manual` pelo mesmo motivo (identificador + id da opção).
 */
export default ModuleProvider(Modules.FULFILLMENT, {
  services: [TabelaFulfillmentService],
})
