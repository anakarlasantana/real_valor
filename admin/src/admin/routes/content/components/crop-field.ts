/** O par `imageUrl` → `imageUrlCrop` e o que o modal lê: só tipos e o nome. */
import type { FrameBox } from "../lib/crop-window"

export type CropHelp = {
  zoomMax?: number
  help?: { gesture: string; ratioZoom: string; reset: string }
}

/** A janela do modal (`variantBox`), o recorte gravado e a foto da prévia. */
export type CropTarget = { box: FrameBox; crop: unknown; src?: string; note?: string }

/** `imageUrl` → `imageUrlCrop`. */
export function cropNameOf(imageName: string): string {
  return `${imageName}Crop`
}
