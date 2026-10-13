/**
 * Uma página no acordeão: o cabeçalho com o estado dela e, embaixo, os blocos.
 * -------------------------------------------------------------------------
 * O estado ("Publicada", "Despublicada", "Vazia") aqui é uma leitura de
 * conveniência do cabeçalho: conta as seções que a API devolveu **para o lojista
 * saber o que esperar antes de abrir a lista** — não para decidir se a página
 * está no ar. Essa régua é a do servidor (`GET /admin/content/pages`, ver
 * `pages-view.tsx`), e é a mesma que a rota da loja aplica antes de responder 404.
 *
 * Sem `<Button>` dentro de `<Button>`: o cabeçalho é uma linha clicável e o "Nova
 * seção" é um botão irmão dela — aninhar botões é HTML inválido e o navegador
 * resolve o clique do jeito dele.
 */
import { ChevronDown, Plus } from "@medusajs/icons"
import { Badge, Button, Container, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

import type { ContentSurfaceSpec } from "@conteudo/contract"

import { apiUrl } from "../../lib/api-url"
import { PageSectionsPanel } from "./PageSectionsPanel"
import type { Schema, Section } from "./types"

export interface PageAccordionItemProps {
  surface: ContentSurfaceSpec
  isExpanded: boolean
  onToggle: (expanded: boolean) => void
}

type PageState = "empty" | "published" | "unpublished"

/** O tom do estado da página, para o `Badge` (`green` | `orange` | `grey`). */
function stateTone(state: PageState): "green" | "orange" | "grey" {
  if (state === "published") return "green"
  return state === "unpublished" ? "orange" : "grey"
}

export function PageAccordionItem({
  surface,
  isExpanded,
  onToggle,
}: PageAccordionItemProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [schema, setSchema] = useState<Schema | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  // A leitura do cabeçalho, uma por abertura: o estado da página tem de refletir
  // o que a lista acabou de gravar (salvar uma seção e fechar o acordeão não pode
  // deixar o "Despublicada" no lugar do "Publicada").
  useEffect(() => {
    if (!isExpanded) return

    let active = true

    const read = async () => {
      setLoading(true)

      try {
        const res = await fetch(
          apiUrl(`/admin/content?surface=${encodeURIComponent(surface.id)}`),
          { credentials: "include" }
        )
        const json = await res.json()

        if (!active) return

        if (!res.ok) {
          toast.error(json.message ?? "Falha ao carregar as seções.")
          return
        }

        setSections(json.sections ?? [])
        setSchema(json.schema ?? null)
      } catch (error) {
        if (!active) return

        toast.error("Não foi possível carregar as seções.")
        console.error(error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void read()

    return () => {
      active = false
    }
  }, [isExpanded, surface.id])

  const published = sections.filter((section) => section.enabled).length
  const total = sections.length
  const state: PageState =
    total === 0 ? "empty" : published > 0 ? "published" : "unpublished"
  const stateLabel =
    state === "published"
      ? "Publicada"
      : state === "unpublished"
        ? "Despublicada"
        : "Vazia"

  return (
    <Container className="overflow-hidden rounded-lg border border-ui-border-base p-0">
      <div className="flex items-center justify-between gap-x-4 p-4">
        <button
          type="button"
          aria-expanded={isExpanded}
          className="flex flex-1 items-center gap-x-3 text-left"
          onClick={() => onToggle(!isExpanded)}
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
          <Text weight="plus">{surface.label}</Text>
          <Badge size="2xsmall" color={stateTone(state)}>
            {stateLabel}
          </Badge>
        </button>

        <Button
          size="small"
          variant={creating ? "secondary" : "primary"}
          disabled={loading}
          onClick={() => setCreating((open) => !open)}
        >
          {creating ? (
            "Fechar"
          ) : (
            <>
              <Plus className="h-3 w-3" /> Nova seção
            </>
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-ui-border-base p-4">
          {loading ? (
            <Text size="small" className="text-ui-fg-subtle">
              Carregando seções…
            </Text>
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
