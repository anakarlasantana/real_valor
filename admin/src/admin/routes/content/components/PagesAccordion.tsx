/**
 * O acordeão das páginas institucionais — um item por página do contrato.
 * -------------------------------------------------------------------------
 * Qual página está aberta é estado do **pai** (`page.tsx`), e não deste
 * componente: o índice "Páginas" (`PagesView`) tem um atalho por linha ("Editar
 * blocos"), e o atalho é abrir o acordeão certo — sem inventar navegação. Se o
 * estado morasse aqui, o atalho não teria como abrir a página que ele nomeia.
 */
import { Container } from "@medusajs/ui"

import type { ContentSurfaceSpec } from "@conteudo/contract"

import { PageAccordionItem } from "./PageAccordionItem"

export interface PagesAccordionProps {
  surfaces: ContentSurfaceSpec[]
  /** A página aberta (uma por vez), ou `null` com todas fechadas. */
  openId: string | null
  onToggle: (id: string, expanded: boolean) => void
}

export function PagesAccordion({
  surfaces,
  openId,
  onToggle,
}: PagesAccordionProps) {
  return (
    <Container className="flex flex-col gap-y-4">
      {surfaces.map((surface) => (
        <PageAccordionItem
          key={surface.id}
          surface={surface}
          isExpanded={openId === surface.id}
          onToggle={(expanded) => onToggle(surface.id, expanded)}
        />
      ))}
    </Container>
  )
}
