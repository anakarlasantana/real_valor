/**
 * Tipos compartilhados entre os componentes da tela de conteúdo.
 * Extraídos de page.tsx para evitar duplicação e permitir reuso.
 */
import type { ContentSurfaceSpec, Schema, OrderFaixa } from "@conteudo/contract"

/** Seção de conteúdo como vem da API admin. */
export type Section = {
  id: string
  type: string
  enabled: boolean
  position: number
  fixed: boolean
  data: Record<string, unknown>
  [key: string]: unknown
}

/** Rascunho de edição de uma seção (form-draft). */
export type Draft = Record<string, unknown>

/** Estado de uma superfície (vitrine, página, tema). */
export interface SurfaceState {
  sections: Section[]
  schema: Schema | null
  order: OrderFaixa | null
  drafts: Record<string, Draft>
  openId: string | null
  creating: boolean
  newType: string
  newId: string
  pendingOrder: string[] | null
  working: string | null
}

/** Modos de visualização da tela de conteúdo. */
export type ViewMode = "vitrine" | "pages" | "theme"

/** Props para o painel genérico de seções de uma superfície. */
export interface SurfaceSectionsPanelProps {
  surfaceId: string
  surface: ContentSurfaceSpec
  initialSections?: Section[]
  initialSchema?: Schema | null
  creating?: boolean
  setCreating?: (v: boolean) => void
}

/** Props para a linha de uma seção. */
export interface SectionRowProps {
  section: Section
  draft: Draft
  schema: Schema | null
  surface: ContentSurfaceSpec
  numeral: number
  movable: boolean
  isOpen: boolean
  onToggleOpen: (id: string | null) => void
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onMove: (fromIndex: number, toIndex: number) => void
}

/** Props para o criador de seção (modal "Nova seção"). */
export interface SectionCreatorProps {
  surface: ContentSurfaceSpec
  schema: Schema | null
  sections: Section[]
  isOpen: boolean
  onClose: () => void
  onCreate: (type: string, id?: string) => Promise<void>
}

/** Props para a barra de ordem alterada. */
export interface OrderDirtyBarProps {
  onSave: () => Promise<void>
  onDiscard: () => void
}