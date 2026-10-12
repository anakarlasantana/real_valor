/**
 * Modo "Conteúdo Vitrine" — edita a home (surface = "home").
 * Wrapper fino ao redor de SurfaceSectionsPanel.
 */
import type { ContentSurfaceSpec } from "@conteudo/contract"

import { SurfaceSectionsPanel } from "./SurfaceSectionsPanel"
import type { Schema } from "./types"

export function VitrineSections({ schema }: { schema: Schema | null }) {
  const surface = schema?.surfaces?.find(
    (spec: ContentSurfaceSpec) => spec.id === "home"
  )

  if (!surface) return null

  return <SurfaceSectionsPanel surfaceId="home" surface={surface} />
}
