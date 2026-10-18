/** O `style` de uma foto recortada (a conta é do `@rv/contrato/crop`). */
import { cropImageStyle } from "@rv/contrato/crop"
import type { CSSProperties } from "react"

export function cropStyle(crop: unknown): CSSProperties | undefined {
  return cropImageStyle(crop) as CSSProperties | undefined
}
