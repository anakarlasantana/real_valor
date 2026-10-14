/**
 * Tipos compartilhados entre os componentes da tela de conteúdo.
 * -------------------------------------------------------------------------
 * Extraídos de page.tsx para evitar duplicação e permitir reuso.
 *
 * O payload do schema (`Schema`) e a faixa da numeração (`OrderFaixa`) **não**
 * são declarados aqui: eles vêm do contrato pelo alias `@conteudo/*`
 * (`admin/tsconfig.json`), como em `form-draft.ts` e `list-order.ts`. O
 * `import type` some no build — o painel continua sem dependência de runtime com
 * o backend —, e o nome de cada campo passa a ser conferido por compilação. A
 * cópia local de `Schema` era o defeito que `../__tests__/panel-wiring.unit.spec.ts`
 * proíbe (`SHAPES`): o alias para o contrato é o que se quer, a cópia não.
 */
import type { CategoryRef, ContentSurfaceSpec } from "@conteudo/contract"
import type { ContentSchemaPayload } from "@conteudo/schema"

/** O schema que o CRM desenha — o `schema` de `GET /admin/content`. */
export type Schema = ContentSchemaPayload

/**
 * Seção de conteúdo como a API admin a devolve.
 *
 * É a linha **achatada** (`toSection`, em `modules/content/view.ts`): as colunas
 * de controle e o `data` do tipo no mesmo nível. O "Salvar" devolve o mesmo
 * achatamento — o `data` não viaja aninhado em lugar nenhum.
 */
export type Section = {
  id: string
  type: string
  enabled: boolean
  position: number
  /** A coluna `fixed`: a seção ancorada (cromo da loja), que não tem ordem. */
  fixed: boolean
  [key: string]: unknown
}

/** Rascunho de edição de uma seção: o que o formulário mostra, antes de salvar. */
export type Draft = Record<string, unknown>

/** Modos de visualização da tela de conteúdo (as três abas do topo). */
export type ViewMode = "vitrine" | "pages" | "theme"

/** Props do painel genérico de seções de uma superfície (vitrine, tema, página). */
export interface SurfaceSectionsPanelProps {
  surfaceId: string
  surface: ContentSurfaceSpec
  /** Primeira pintura: o que o pai já carregou. O hook recarrega da API. */
  initialSections?: Section[]
  initialSchema?: Schema | null
  /** O diálogo "Nova seção" aberto, quando quem manda no estado é o pai. */
  creating?: boolean
  setCreating?: (value: boolean) => void
  /** Esconde o cabeçalho do painel: o acordeão de páginas já traz o dele. */
  embedded?: boolean
}

/** Props da linha de uma seção. */
export interface SectionRowProps {
  section: Section
  draft: Draft
  schema: Schema | null
  surface: ContentSurfaceSpec
  /** O catálogo de categorias (`list:category`) — vem no payload, não do contrato. */
  categories: readonly CategoryRef[]
  numeral: number
  movable: boolean
  isOpen: boolean
  /** A casa da seção na vitrine: o índice que as setas usam. */
  place: number
  /** O tamanho da vitrine: o limite da seta para baixo. */
  shownLength: number
  /** Operação em andamento na lista (trava as setas e o "Remover"). */
  working: string | null
  /** O id em gravação: o "Salvar" do formulário entra em espera. */
  savingId: string | null
  onToggleOpen: (id: string | null) => void
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  /** Devolve o formulário ao que está gravado (o "Descartar" da seção). */
  onDiscard: (section: Section) => void
  onSave: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onMove: (id: string, direction: -1 | 1) => void
}

/** Props do criador de seção (o diálogo "Nova seção"). */
export interface SectionCreatorProps {
  surface: ContentSurfaceSpec
  schema: Schema | null
  sections: Section[]
  isOpen: boolean
  onClose: () => void
  /**
   * Cria a seção (tipo + âncora) e diz se deu certo: o diálogo só fecha no
   * sucesso, para uma recusa da API não levar junto o que foi digitado.
   */
  onCreate: (type: string, id?: string) => Promise<boolean>
}

/** Props da barra "Ordem alterada — ainda não salva". */
export interface OrderDirtyBarProps {
  onSave: () => Promise<void>
  onDiscard: () => void
  /**
   * O que está em curso na tela: `"order"` é a gravação da ordem (o "Salvar
   * ordem" entra em espera), qualquer outro valor é outra operação e trava os
   * dois botões — duas gravações concorrentes na mesma lista se atropelam.
   */
  working: string | null
}
