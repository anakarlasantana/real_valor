/** A moldura de prévia: a caixa do componente que recebe a foto. */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { ratioOf, ratioValue, type FrameBox } from "../lib/crop-window"

export function CropFrame({
  box,
  ratioLocked = false,
  size,
  className = "",
  children,
  ...props
}: {
  /** A moldura da seção (`slotBox`) ou do formato dela (`variantBox`). */
  box: FrameBox
  /** A moldura de proporção fixa: o zoom é avisado, não escondido. */
  ratioLocked?: boolean
  /** O tamanho medido (`fitFrame`), quando há palco. */
  size?: { width: number; height: number }
  className?: string
  children?: ReactNode
} & HTMLAttributes<HTMLDivElement>) {
  // Sem `size`, o CSS a dimensiona: `min(100%, altura × razão)` no palco
  // (`container-type: size`) cabe nos dois eixos — medido, ficava 2×2, sem foto.
  const style: CSSProperties = size
    ? { width: size.width, height: size.height }
    : {
        aspectRatio: ratioOf(box),
        width: `min(100%, calc(100cqh * ${ratioValue(box)}))`,
        height: "auto",
        maxHeight: "100%",
      }

  return (
    <div
      {...props}
      data-crop-frame={box.fit}
      data-crop-ratio-locked={ratioLocked ? "true" : "false"}
      className={`relative overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-submenu ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
