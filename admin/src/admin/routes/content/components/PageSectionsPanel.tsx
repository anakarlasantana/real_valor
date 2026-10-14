/**
 * As seções de uma página, dentro do acordeão.
 * -------------------------------------------------------------------------
 * É o painel genérico (`SurfaceSectionsPanel`), e **só** ele: o que muda aqui é o
 * diálogo "Nova seção", que o acordeão abre pelo botão do cabeçalho da página (por
 * isso o `creating`/`setCreating` vêm de fora) e o cabeçalho do painel, que o
 * `label` da página já escreveu (`embedded`).
 *
 * Antes desta fase este arquivo era uma segunda cópia do painel, com a própria
 * chamada do hook e a própria lista — e as duas cópias divergiram: só uma tinha a
 * separação do cromo, o numeral da ordem pendente e o "Salvar" da seção que grava
 * de verdade.
 */
import { SurfaceSectionsPanel } from "./SurfaceSectionsPanel"
import type { ContentSurfaceSpec } from "@conteudo/contract"
import type { Schema, Section } from "../lib/types"

export interface PageSectionsPanelProps {
  surfaceId: string
  surface: ContentSurfaceSpec
  initialSections: Section[]
  initialSchema: Schema | null
  creating: boolean
  setCreating: (value: boolean) => void
}

export function PageSectionsPanel({
  surfaceId,
  surface,
  initialSections,
  initialSchema,
  creating,
  setCreating,
}: PageSectionsPanelProps) {
  return (
    <SurfaceSectionsPanel
      surfaceId={surfaceId}
      surface={surface}
      initialSections={initialSections}
      initialSchema={initialSchema}
      creating={creating}
      setCreating={setCreating}
      embedded
    />
  )
}
