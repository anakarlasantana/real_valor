/**
 * Linha de uma seção na lista — numeral, drag-drop, toggle, formulário, trilhos de aparência.
 * Componente genérico reutilizado por VitrineSections, PageSectionsPanel, ThemeSections.
 */
import { ArrowDownMini, ArrowUpMini, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Switch, Text, toast } from "@medusajs/ui"
import { useCallback, useState, type ReactNode } from "react"

import { AppearanceRail } from "./appearance-controls"
import { FieldInput, type FieldSpec } from "./field-input"
import { isDirty, wireValue } from "./form-draft"
import { move, itemSummary } from "./list-order"
import { numeralFor } from "./page"
import type { Section, Draft, Schema, OrderFaixa, ContentSurfaceSpec } from "./types"

interface SectionRowProps {
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

export function SectionRow({
  section,
  draft,
  schema,
  surface,
  numeral,
  movable,
  isOpen,
  onToggleOpen,
  onUpdate,
  onRemove,
  onMove,
}: SectionRowProps) {
  const specs = schema?.fields[section.type] ?? []
  const typeLabel = schema?.typeLabels?.[section.type] ?? section.type
  const dirty = isDirty(draft, section)

  // Garante que section.data nunca seja undefined (seções novas vêm com data: undefined)
  const sectionData = section.data ?? {}

  const handleSave = useCallback(async () => {
    await onUpdate(section.id, draft)
    toast.success("Salvo.")
  }, [draft, onUpdate, section.id])

  const handleCancel = useCallback(() => {
    onUpdate(section.id, { ...section })
  }, [onUpdate, section])

  const handleToggle = useCallback(async () => {
    await onUpdate(section.id, { enabled: !section.enabled })
  }, [onUpdate, section])

  const handleMoveUp = useCallback(() => {
    const place = numeral - 1
    onMove(place, place - 1)
  }, [numeral, onMove])

  const handleMoveDown = useCallback(() => {
    const place = numeral - 1
    onMove(place, place + 1)
  }, [numeral, onMove])

  const renderFields = (): ReactNode => {
    if (!specs.length) return null

    return (
      <div className="flex flex-col gap-y-4 pt-4 border-t border-ui-border-base">
        {specs.map((spec) => (
          <FieldInput
            key={spec.name}
            spec={spec}
            value={draft[spec.name] ?? sectionData[spec.name]}
            onChange={(v) => onUpdate(section.id, { ...draft, [spec.name]: v })}
            references={{
              palette: schema?.palette,
              fonts: schema?.fonts,
              destinations: schema?.destinations,
              categories: [],
              markdownMarks: schema?.markdownMarks,
            }}
          />
        ))}
        {surface.blockLabel && (
          <AppearanceRail
            surface={surface}
            sectionType={section.type}
            sectionData={sectionData}
            onChange={(v) => onUpdate(section.id, { ...draft, ...v })}
            palette={schema?.palette}
            fonts={schema?.fonts}
          />
        )}
      </div>
    )
  }

  return (
    <Container key={section.id} className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-x-4 p-4">
        <div className="flex items-center gap-x-3">
          {movable ? (
            <>
              <Badge size="2xsmall">{numeral}</Badge>
              <div className="flex flex-col gap-y-1">
                <Button
                  variant="transparent"
                  size="small"
                  className="h-6 w-6 p-0"
                  onClick={handleMoveUp}
                  disabled={numeral === 1}
                >
                  <ArrowUpMini className="h-3 w-3" />
                </Button>
                <Button
                  variant="transparent"
                  size="small"
                  className="h-6 w-6 p-0"
                  onClick={handleMoveDown}
                >
                  <ArrowDownMini className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex shrink-0 items-center gap-x-2">
              <Badge size="2xsmall" variant="secondary">
                {numeral}
              </Badge>
              <Badge size="2xsmall" variant="outline">
                Fixo
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-x-2">
            <Text size="small" weight="plus">
              {typeLabel}
            </Text>
            {dirty && (
              <Badge size="2xsmall" variant="warning">
                Pendente
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          <Switch
            checked={section.enabled}
            onCheckedChange={handleToggle}
            size="small"
            aria-label={section.enabled ? "Desativar" : "Ativar"}
          />
          <Button
            variant="transparent"
            size="small"
            onClick={() => onToggleOpen(isOpen ? null : section.id)}
            aria-label={isOpen ? "Fechar" : "Editar"}
          >
            {isOpen ? "Fechar" : "Editar"}
          </Button>
          <Button
            variant="transparent"
            size="small"
            color="danger"
            onClick={() => onRemove(section.id)}
            aria-label="Remover"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-x-4 mb-4">
            <div className="flex items-center gap-x-2">
              <Text size="small" className="text-ui-fg-subtle">
                Editando <strong>{typeLabel}</strong> (id: {section.id})
              </Text>
            </div>
            <div className="flex items-center gap-x-2">
              <Button variant="secondary" size="small" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button size="small" onClick={handleSave} disabled={!dirty}>
                Salvar
              </Button>
            </div>
          </div>
          {renderFields()}
        </div>
      )}
    </Container>
  )
}
