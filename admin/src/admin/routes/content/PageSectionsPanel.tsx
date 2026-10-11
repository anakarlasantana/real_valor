/**
 * Painel de seções dentro de um acordeão de página — reutiliza SurfaceSectionsPanel
 * mas com toolbar contextual da página e sem o header duplicado.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Button, Container, Text } from "@medusajs/ui"

import { useSurfaceSections } from "./hooks/useSurfaceSections"
import { SectionRow } from "./SectionRow"
import { SectionCreator } from "./SectionCreator"
import { OrderDirtyBar } from "./OrderDirtyBar"
import { creatableTypes, freeAnchor, numeralFor } from "./utils"
import type { ContentSurfaceSpec, Schema, Section } from "@conteudo/contract"

interface PageSectionsPanelProps {
  surfaceId: string
  surface: ContentSurfaceSpec
  initialSections: Section[]
  initialSchema: Schema | null
  creating: boolean
  setCreating: (v: boolean) => void
}

export function PageSectionsPanel({
  surfaceId,
  surface,
  initialSections,
  initialSchema,
  creating,
  setCreating,
}: PageSectionsPanelProps) {
  const {
    sections,
    schema,
    order,
    drafts,
    openId,
    setOpenId,
    newType,
    setNewType,
    newId,
    setNewId,
    pendingOrder,
    setPendingOrder,
    working,
    orderDirty,
    load,
    create,
    update,
    remove,
    restore,
    saveOrder,
    reorder,
  } = useSurfaceSections(surfaceId, { initialSections, initialSchema })

  const currentSurface = schema?.surfaces?.find((s) => s.id === surfaceId) ?? null
  const types = schema ? creatableTypes(schema, sections, currentSurface) : []

  useEffect(() => {
    if (!schema || newType) return
    const first = creatableTypes(schema, sections, currentSurface)[0] ?? ""
    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
  }, [schema, sections, newType, currentSurface])

  const vitrineIndex = useMemo(() => {
    const map = new Map<string, number>()
    sections.forEach((s, i) => map.set(s.id, i))
    return map
  }, [sections])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between gap-x-4">
        <div className="flex items-center gap-x-2">
          <Text size="small" className="text-ui-fg-subtle">
            Seções de <strong>{surface.label}</strong>
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" onClick={load} disabled={working}>
            Recarregar
          </Button>
          <Button size="small" variant="secondary" onClick={restore} disabled={working}>
            Restaurar padrão
          </Button>
        </div>
      </div>

      <SectionCreator
        surface={surface}
        schema={schema}
        sections={sections}
        isOpen={creating}
        setCreating={setCreating}
        onCreate={create}
      />

      {sections.map((section) => {
        const draft = drafts[section.id] ?? {}
        const isOpen = openId === section.id
        const movable = !section.fixed
        const place = sections.findIndex((s) => s.id === section.id)
        const numeral = pendingOrder && order
          ? numeralFor(place, order)
          : section.position

        return (
          <SectionRow
            key={section.id}
            section={section}
            draft={draft}
            schema={schema}
            surface={surface}
            numeral={numeral}
            movable={movable}
            isOpen={isOpen}
            onToggleOpen={setOpenId}
            onUpdate={async (id, data) => update(id, data)}
            onRemove={remove}
            onMove={reorder}
          />
        )
      })}

      {orderDirty && (
        <OrderDirtyBar onSave={saveOrder} onDiscard={() => setPendingOrder(null)} />
      )}
    </div>
  )
}
