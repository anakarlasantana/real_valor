import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import SuperFreteFulfillmentService from "./service"

/** O provider `superfrete`: PAC, SEDEX e Mini Envios cotados pela API. */
export default ModuleProvider(Modules.FULFILLMENT, {
  services: [SuperFreteFulfillmentService],
})
