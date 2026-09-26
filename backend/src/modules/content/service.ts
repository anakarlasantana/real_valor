import { MedusaService } from "@medusajs/framework/utils"

import ContentBlock from "./models/content-block"

/**
 * Serviço do módulo de conteúdo.
 *
 * Além dos métodos gerados (`listContentBlocks`, `retrieveContentBlock`,
 * `createContentBlocks`, `updateContentBlocks`, `deleteContentBlocks`),
 * expõe `listSections` — que monta as seções já no formato do contrato,
 * com `data` desaninhado no nível raiz. É o que as duas rotas de API
 * usam, para que achatamento e normalização fiquem num lugar só.
 */
class ContentModuleService extends MedusaService({
  ContentBlock,
}) {
  /**
   * Lista as seções de uma superfície, ordenadas e achatadas.
   *
   * @param surface  `home` por padrão.
   * @param onlyEnabled  Quando true, filtra as desabilitadas no banco.
   */
  async listSections({
    surface = "home",
    onlyEnabled = false,
  }: { surface?: string; onlyEnabled?: boolean } = {}) {
    const blocks = await this.listContentBlocks(
      {
        surface,
        ...(onlyEnabled ? { enabled: true } : {}),
      },
      { order: { position: "ASC" } }
    )

    return blocks.map((block) => ({
      id: block.id,
      enabled: block.enabled,
      position: block.position,
      type: block.type,
      ...(block.data ?? {}),
    }))
  }
}

export default ContentModuleService
