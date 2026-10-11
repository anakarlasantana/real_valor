/**
 * Item individual do acordeão de páginas — header com label + badge + botão Nova seção,
 * conteúdo expansível com PageSectionsPanel (carregamento lazy).
 */
import { useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { ChevronDown, Plus } from "@medusajs/icons"
import type { ContentSurfaceSpec, Schema, Section } from "@conteudo/contract"
import { PageSectionsPanel } from "./PageSectionsPanel"

export interface PageAccordionItemProps {
  surface: ContentSurfaceSpec
  isExpanded: boolean
  onToggle: (expanded: boolean) => void
}

export function PageAccordionItem({ surface, isExpanded, onToggle }: PageAccordionItemProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [schema, setSchema] = useState<Schema | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isExpanded && sections.length === 0 && !loading) {
      loadSections()
    }
  }, [isExpanded])

  const loadSections = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/content?surface=${surface.id}`, {
        credentials: "include",
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar as seções.")
        return
      }
      setSections(json.sections ?? [])
      setSchema(json.schema ?? null)
    } catch (error) {
      toast.error("Não foi possível carregar as seções.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const publishedCount = sections.filter(s => s.enabled).length
  const totalCount = sections.length
  const state = totalCount === 0 ? "empty" : publishedCount > 0 ? "published" : "unpublished"
  const stateLabel = state === "published" ? "Publicada" : state === "unpublished" ? "Despublicada" : "Vazia"
  const stateVariant = state === "published" ? "success" : state === "unpublished" ? "warning" : "secondary"

  return (
    <Container className="border border-ui-border-base rounded-lg overflow-hidden">
      <Button
        variant="secondary"
        className="w-full justify-between p-4"
        onClick={() => onToggle(!isExpanded)}
      >
        <div className="flex items-center gap-x-3">
          <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          <Text weight="plus">{surface.label}</Text>
          <Badge size="2xsmall" variant={stateVariant as any}>
            {stateLabel}
          </Badge>
        </div>
        <Button
          size="small"
          variant="primary"
          disabled={loading}
          onClick={(e) => { e.stopPropagation(); setCreating(true) }}
        >
          <Plus className="h-3 w-3" /> Nova seção
        </Button>
      </Button>

      {isExpanded && (
        <div className="border-t border-ui-border-base p-4">
          {loading ? (
            <Text size="small" className="text-ui-fg-subtle">Carregando seções…</Text>
          ) : (
            <PageSectionsPanel
              surfaceId={surface.id}
              surface={surface}
              initialSections={sections}
              initialSchema={schema}
              creating={creating}
              setCreating={setCreating}
            />
          )}
        </div>
      )}
    </Container>
  )
}
