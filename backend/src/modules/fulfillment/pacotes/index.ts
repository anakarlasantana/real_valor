import { Module } from "@medusajs/framework/utils"

import PacotesModuleService from "./service"

/** Chave de resolução no container (`req.scope.resolve(PACOTES_MODULE)`) — é
 * por ela que o provider do SuperFrete acha as caixas fora de uma requisição. */
export const PACOTES_MODULE = "pacotes"

export default Module(PACOTES_MODULE, {
  service: PacotesModuleService,
})
