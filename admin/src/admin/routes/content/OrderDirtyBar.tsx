/**
 * Barra amarela "Ordem alterada — ainda não salva" com botões Salvar/Descartar.
 * Componente genérico reutilizado por VitrineSections, PageSectionsPanel, ThemeSections.
 */
import { Button, Container, Text } from "@medusajs/ui"
import type { ReactNode } from "react"

export interface OrderDirtyBarProps {
  onSave: () => Promise<void>
  onDiscard: () => void
}

export function OrderDirtyBar({ onSave, onDiscard }: OrderDirtyBarProps) {
  return (
    <Container className="flex items-center justify-between gap-x-4 bg-ui-bg-subtle border border-ui-border-base rounded-lg p-4 my-4">
      <div>
        <Text size="small" weight="plus">
          Ordem alterada — ainda não salva
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          A loja continua mostrando a ordem anterior até você salvar. As
          demais edições desta tela não dependem disto.
        </Text>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        <Button variant="secondary" size="small" onClick={onDiscard}>
          Descartar
        </Button>
        <Button size="small" onClick={onSave}>
          Salvar ordem
        </Button>
      </div>
    </Container>
  )
}
