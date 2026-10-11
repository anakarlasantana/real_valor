/**
 * Painel genérico de seções de uma superfície (vitrine, página ou tema).
 * Usa o hook useSurfaceSections e renderiza SectionRow + SectionCreator + OrderDirtyBar.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Button, Text } from "@medusajs/ui"

import { useSurfaceSections } from "./hooks/useSurfaceSections"
import { SectionRow } from "./SectionRow"
import { SectionCreator } from "./SectionCreator"
import { OrderDirtyBar } from "./OrderDirtyBar"
import { creatableTypes, freeAnchor, numeralFor } from "./utils"
import type { ContentSurfaceSpec, Schema, Section } from "@conteudo/contract"
import type { SurfaceSectionsPanelProps } from "./types"

export function SurfaceSectionsPanel({
  surfaceId,
  surface,
  initialSections = [],
  initialSchema = null,
}: SurfaceSectionsPanelProps) {
  const {
    sections,
    schema,
    order,
    drafts,
    openId,
    setOpenId,
    creating,
    setCreating,
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

  // currentSurface para creatableTypes
  const currentSurface = schema?.surfaces?.find((s) => s.id === surfaceId) ?? null
  const types = schema ? creatableTypes(schema, sections, currentSurface) : []

  // Sugere primeiro tipo e anchor livre
  useEffect(() => {
    if (!schema || newType) return
    const first = creatableTypes(schema, sections, currentSurface)[0] ?? ""
    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
  }, [schema, sections, newType, currentSurface])

  const handleSave = useCallback(async (id: string, draft: Record<string, unknown>) => {
    await update(id, draft)
  }, [update])

  const handleRemove = useCallback(async (id: string) => {
    await remove(id)
  }, [remove])

  const handleMove = useCallback((fromIndex: number, toIndex: number) => {
    reorder(fromIndex, toIndex)
  }, [reorder])

  const vitrineIndex = useMemo(() => {
    const map = new Map<string, number>()
    sections.forEach((s, i) => map.set(s.id, i))
    return map
  }, [sections])

  return (
    <div className="flex flex-col gap-y-4">
      {/* Toolbar da superfície */}
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

      {/* "Nova seção" inline */}
      <SectionCreator
        surface={surface}
        schema={schema}
        sections={sections}
        isOpen={creating}
        setCreating={setCreating}
        onCreate={create}
      />

      {/* Lista de seções */}
      {sections.map((section) => {
        const draft = drafts[section.id] ?? {}
        const isOpen = openId === section.id
        const movable = !section.fixed
        const place = vitrineIndex.get(section.id) ?? 0
        const numeral = orderDirty && order
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
            onUpdate={handleSave}
            onRemove={handleRemove}
            onMove={handleMove}
          />
        )
      })}

      {/* Barra "Salvar ordem" */}
      {orderDirty && (
        <OrderDirtyBar onSave={saveOrder} onDiscard={() => setPendingOrder(null)} />
      )}
    </div>
  )
}
