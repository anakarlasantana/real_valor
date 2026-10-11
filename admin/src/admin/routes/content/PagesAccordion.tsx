/**
 * Acordeão principal das páginas institucionais — renderiza um PageAccordionItem
 * para cada página declarada no contrato (PAGE_SURFACES).
 */
import { useState } from "react"
import { Container } from "@medusajs/ui"
import type { ContentSurfaceSpec } from "@conteudo/contract"
import { PageAccordionItem } from "./PageAccordionItem"

export interface PagesAccordionProps {
  surfaces: ContentSurfaceSpec[]
}

export function PagesAccordion({ surfaces }: PagesAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  return (
    <Container className="flex flex-col gap-y-4">
      {surfaces.map((surface) => (
        <PageAccordionItem
          key={surface.id}
          surface={surface}
          isExpanded={expandedIds.has(surface.id)}
          onToggle={(expanded) => {
            const next = new Set(expandedIds)
            expanded ? next.add(surface.id) : next.delete(surface.id)
            setExpandedIds(next)
          }}
        />
      ))}
    </Container>
  )
}
