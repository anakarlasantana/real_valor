/**
 * Constantes de navegação da tela de conteúdo.
 * Define os três pilares: Vitrine, Páginas Institucionais, Tema da Loja.
 *
 * `ViewMode` mora em `./types` (o mesmo dos componentes): o item da barra e o
 * estado da página são o **mesmo** nome, e duas declarações seriam duas respostas
 * para "quais abas existem".
 */
import { GridLayout, DocumentText, Palette } from "@medusajs/icons"
import type { ContentSurfaceSpec } from "@conteudo/contract"

import type { ViewMode } from "./types"

export interface NavItem {
  id: ViewMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

/** As três abas do topo, na ordem em que aparecem. */
export const MAIN_NAVIGATION: readonly NavItem[] = [
  { id: "vitrine", label: "Conteúdo Vitrine", icon: GridLayout },
  { id: "pages", label: "Páginas Institucionais", icon: DocumentText },
  { id: "theme", label: "Tema da Loja", icon: Palette },
] as const

/**
 * Retorna as superfícies de página (`kind === "page"`) na ordem do contrato.
 * Usado pelo `PagesAccordion` para renderizar os acordeões.
 *
 * A lista sai do **schema** que a API devolve (o registro no Postgres), e não de
 * uma constante aqui: uma página nova no contrato aparece na tela sem edição em
 * React.
 */
export function getPageSurfaces(schema?: {
  surfaces?: readonly ContentSurfaceSpec[]
} | null): ContentSurfaceSpec[] {
  const surfaces = schema?.surfaces ?? []

  return surfaces.filter((spec) => spec.kind === "page")
}
