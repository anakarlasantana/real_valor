import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { ResendNotificationService } from "./service"

/**
 * O provider de notificação. O `id` do item em `medusa-config.ts` é que nomeia
 * o provider no banco (`resend`); a classe só declara o serviço.
 */
export default ModuleProvider(Modules.NOTIFICATION, {
  services: [ResendNotificationService],
})
