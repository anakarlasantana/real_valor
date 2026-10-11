/**
 * Constantes de navegação da tela de conteúdo.
 * Define os três pilares: Vitrine, Páginas Institucionais, Tema da Loja.
 */
import { GridLayout, DocumentText, Palette } from "@medusajs/icons"
import type { ContentSurfaceSpec } from "@conteudo/contract"

export interface NavItem {
  id: ViewMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export type ViewMode = "vitrine" | "pages" | "theme"

export const MAIN_NAVIGATION: readonly NavItem[] = [
  { id: "vitrine", label: "Conteúdo Vitrine", icon: GridLayout },
  { id: "pages", label: "Páginas Institucionais", icon: DocumentText },
  { id: "theme", label: "Tema da Loja", icon: Palette },
] as const

/**
 * Retorna as superfícies de página (kind === "page") na ordem do contrato.
 * Usado pelo PagesAccordion para renderizar os acordeões.
 * O schema vem da API (já gravado no banco via seed-schema).
 */
export function getPageSurfaces(schema?: { surfaces?: ContentSurfaceSpec[] }): ContentSurfaceSpec[] {
  const surfaces = schema?.surfaces ?? []
  return surfaces.filter((s) => s.kind === "page")
}