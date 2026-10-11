/**
 * Modo "Conteúdo Vitrine" — edita a home (surface = "home").
 * Wrapper fino ao redor de SurfaceSectionsPanel.
 */
import { SurfaceSectionsPanel } from "./SurfaceSectionsPanel"
import type { ContentSurfaceSpec } from "@conteudo/contract"

export function VitrineSections({ schema }: { schema: any }) {
  const vitrineSurface = schema?.surfaces?.find((s: ContentSurfaceSpec) => s.id === "home")
  if (!vitrineSurface) return null

  return (
    <SurfaceSectionsPanel
      surfaceId="home"
      surface={vitrineSurface}
    />
  )
}
