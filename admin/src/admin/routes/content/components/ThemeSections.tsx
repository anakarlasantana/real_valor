/**
 * Modo "Tema da Loja" — edita as estações (surface = "theme").
 * Wrapper fino ao redor de SurfaceSectionsPanel.
 */
import type { ContentSurfaceSpec } from "@conteudo/contract"

import { SurfaceSectionsPanel } from "./SurfaceSectionsPanel"
import type { Schema } from "../lib/types"

export function ThemeSections({ schema }: { schema: Schema | null }) {
  const surface = schema?.surfaces?.find(
    (spec: ContentSurfaceSpec) => spec.id === "theme"
  )

  if (!surface) return null

  return <SurfaceSectionsPanel surfaceId="theme" surface={surface} />
}
