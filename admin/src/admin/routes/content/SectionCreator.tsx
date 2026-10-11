/**
 * Modal "Nova seção" — escolhe tipo e âncora, cria a seção na superfície correta.
 * Componente genérico reutilizado por VitrineSections, PageSectionsPanel, ThemeSections.
 */
import { Plus } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Label, Select, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import type { ContentSurfaceSpec, Schema, Section } from "@conteudo/contract"
import { creatableTypes, freeAnchor } from "./utils"

export interface SectionCreatorProps {
  surface: ContentSurfaceSpec
  schema: Schema | null
  sections: Section[]
  isOpen: boolean
  onClose: () => void
  onCreate: (type: string, id?: string) => Promise<void>
}

export function SectionCreator({
  surface,
  schema,
  sections,
  isOpen,
  onClose,
  onCreate,
}: SectionCreatorProps) {
  const [newType, setNewType] = useState("")
  const [newId, setNewId] = useState("")
  const [loading, setLoading] = useState(false)

  const types = schema ? creatableTypes(schema, sections, surface) : []

  useEffect(() => {
    if (!schema || newType) return
    const first = types[0] ?? ""
    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
  }, [schema, sections, newType, types])

  const handleCreate = useCallback(async () => {
    if (!newType) return
    setLoading(true)
    try {
      await onCreate(newType, newId.trim() || undefined)
      onClose()
    } catch (error) {
      toast.error("Falha ao criar a seção.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [newType, newId, onCreate, onClose])

  if (!isOpen) return null

  return (
    <Container className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Container className="relative w-full max-w-md bg-ui-bg rounded-lg shadow-xl p-6">
        <Heading level="h2" className="mb-4">
          Nova {surface.blockLabel ?? "seção"}
        </Heading>
        <Text size="small" className="text-ui-fg-subtle mb-4">
          A seção nasce com o conteúdo padrão do tipo e entra no fim da lista.
        </Text>

        <div className="flex flex-col gap-y-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value)
                setNewId(freeAnchor(e.target.value, sections))
              }}
              disabled={types.length === 0}
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {schema?.typeLabels?.[type] ?? type}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Âncora (id da seção)</Label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
              placeholder="ex: editorial, banner, prose-1..."
              disabled={!newType}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              É o id da seção e o destino que o menu usa (ex.: /#editorial):
              minúsculas, números e hífen. Já vem sugerida livre.
            </Text>
          </div>

          <div className="flex justify-end gap-x-2 pt-4">
            <Button variant="secondary" size="small" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="small" isLoading={loading} disabled={!newType} onClick={handleCreate}>
              <Plus /> Criar {surface.blockLabel ?? "seção"}
            </Button>
          </div>
        </div>
      </Container>
    </Container>
  )
}
