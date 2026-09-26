import { Module } from "@medusajs/framework/utils"

import ContentModuleService from "./service"

/** Chave de resolução no container do Medusa (`req.scope.resolve(...)`). */
export const CONTENT_MODULE = "content"

export default Module(CONTENT_MODULE, {
  service: ContentModuleService,
})
