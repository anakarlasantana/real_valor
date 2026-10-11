/**
 * Modo "Tema da Loja" — edita as estações (surface = "theme").
 * Wrapper fino ao redor de SurfaceSectionsPanel.
 */
import { SurfaceSectionsPanel } from "./SurfaceSectionsPanel"
import type { ContentSurfaceSpec } from "@conteudo/contract"

export function ThemeSections({ schema }: { schema: any }) {
  const themeSurface = schema?.surfaces?.find((s: ContentSurfaceSpec) => s.id === "theme")
  if (!themeSurface) return null

  return (
    <SurfaceSectionsPanel
      surfaceId="theme"
      surface={themeSurface}
    />
  )
}
