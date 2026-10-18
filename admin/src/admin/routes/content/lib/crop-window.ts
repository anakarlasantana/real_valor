/**
 * A conta do recorte no painel. Nada de valor de `@conteudo/*` (o Vite do painel
 * reprova): a paridade com `@conteudo/crop` é conferida pelo teste de unidade.
 */

/** `center` ou o percentual inteiro do eixo — a leitura do `object-position`. */
export type CropAxis = number | "center"

/** O ponto que fica no meio da moldura e o zoom. */
export type Crop = { x: CropAxis; y: CropAxis; z: number }

/** Um ponto da moldura, em % da caixa (0–100 em cada eixo). */
export type CropPoint = { x: number; y: number }

/** Um degrau da moldura (`CROP_FRAMES`): a caixa da seção em cada tela. */
export type CropFrame = {
  label: string
  from: number
  height?: number
  ratio?: string
}
/** O formato do valor: o mesmo `CROP_PATTERN` do contrato (o `%` é aceito). */
const CROP_PATTERN =
  /^(-?\d{1,3}%?|center):(-?\d{1,3}%?|center)(:([1-3](\.\d{1,2})?))?$/

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3

export const CENTER_CROP: Crop = { x: "center", y: "center", z: 1 }

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) {
    return ZOOM_MIN
  }

  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

function number(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export function parseCrop(value: unknown): Crop | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const text = value.trim()

  if (!CROP_PATTERN.test(text)) {
    return undefined
  }

  const [x, y, z] = text.split(":")

  return {
    x: axis(x),
    y: axis(y),
    z: z === undefined ? ZOOM_MIN : clampZoom(Number(z)),
  }
}

export function formatCrop(crop: Crop): string {
  const x = crop.x === "center" ? "center" : String(crop.x)
  const y = crop.y === "center" ? "center" : String(crop.y)
  const z = clampZoom(crop.z)

  return z === ZOOM_MIN ? `${x}:${y}` : `${x}:${y}:${number(z)}`
}

export function cropImageStyle(
  crop: unknown,
): Record<string, string> | undefined {
  const parsed = parseCrop(crop)

  if (!parsed) {
    return undefined
  }

  const percent = (value: CropAxis) =>
    value === "center" ? "center" : `${value}%`
  const objectPosition = `${percent(parsed.x)} ${percent(parsed.y)}`
  const z = parsed.z

  if (z === ZOOM_MIN) {
    return { objectPosition }
  }

  const shift = (value: CropAxis) => {
    const amount =
      ((value === "center" ? 0.5 : value / 100) * (z - 1) * 100) / z

    return amount === 0 ? "0%" : `-${number(amount)}%`
  }

  return {
    objectPosition,
    position: "absolute",
    top: shift(parsed.y),
    left: shift(parsed.x),
    width: `${number(100 / z)}%`,
    height: `${number(100 / z)}%`,
    maxWidth: "none",
  }
}

function axis(raw: string | undefined): CropAxis {
  if (!raw || raw === "center") {
    return "center"
  }

  return clamp(Number(raw.replace("%", "")))
}

export function cropOf(value: unknown): Crop {
  return parseCrop(value) ?? CENTER_CROP
}

export function valueOf(crop: Crop): string {
  return formatCrop(crop)
}

export function cropFromPoint(point: CropPoint, z = 1): Crop {
  return { x: clamp(point.x), y: clamp(point.y), z: clampZoom(z) }
}

export function pointFromCrop(crop: Crop): CropPoint {
  const eixo = (value: CropAxis) => (value === "center" ? 50 : value)

  return { x: eixo(crop.x), y: eixo(crop.y) }
}

export function zoomCrop(crop: Crop, z: number): Crop {
  return { ...crop, z: clampZoom(z) }
}

export function stepCrop(crop: Crop, direction: -1 | 1): Crop {
  const step = crop.z > 2 ? 0.05 : 0.25
  const next = Math.round((crop.z + direction * step) * 100) / 100

  return zoomCrop(crop, next)
}

export type FrameBox =
  | { fit: "cover" }
  | { fit: "height"; height: number }
  | { fit: "ratio"; ratio: string }

export function frameBox(
  frames: readonly {
    label?: string
    from: number
    height?: number
    ratio?: string
  }[] = [],
  width?: number,
): FrameBox {
  if (!frames.length) {
    return { fit: "cover" }
  }

  const vp = width === undefined ? Infinity : width
  const degrau = [...frames]
    .sort((a, b) => a.from - b.from)
    .reduce((atual, proximo) => (proximo.from <= vp ? proximo : atual))

  if (typeof degrau.height === "number") {
    return { fit: "height", height: degrau.height }
  }

  return degrau.ratio
    ? { fit: "ratio", ratio: degrau.ratio }
    : { fit: "cover" }
}

export function cropFitsBox(crop: unknown, box: FrameBox): boolean {
  const parsed = parseCrop(crop)

  return !parsed || parsed.z === ZOOM_MIN || box.fit === "height"
}

/** A largura de referência de uma moldura de altura: a tela larga da régua. */
const SCREEN = 1440

/**
 * A proporção de um degrau (largura ÷ altura), na largura daquele degrau:
 * `min(1440, from × 1.6)`, vezes a `share` (o card é 1/3 da tela).
 */
function ratioOfFrame(
  frame: { from?: number; height?: number; ratio?: string },
  share = 1,
): number {
  if (typeof frame.height === "number" && frame.height > 0) {
    const width = frame.from ? Math.min(SCREEN, frame.from * 1.6) : SCREEN

    return (width * share) / frame.height
  }

  const [w, h] = (frame.ratio ?? "24/10").split("/").map(Number)

  return h > 0 ? w / h : 2.4
}

/**
 * A moldura **única** do modal: a caixa do componente que vai receber a foto.
 *
 * Os degraus não têm a mesma proporção: a janela fica com a **mais alta**, que
 * é a que mais corta — o recorte aprovado nela vale nas outras.
 */
export function slotBox(
  frames: readonly CropFrame[] = [],
  share = 1,
): FrameBox {
  const fixed = frames.find((frame) => frame.ratio)

  if (fixed?.ratio) {
    return { fit: "ratio", ratio: fixed.ratio }
  }

  if (!frames.length) {
    return { fit: "cover" }
  }

  const apertada = frames
    .map((frame) => ratioOfFrame(frame, share))
    .reduce((atual, proximo) => Math.min(atual, proximo))

  return { fit: "ratio", ratio: `${number(apertada)}/1` }
}

/**
 * A moldura de um **formato** da seção: `collections` desenha os cards em pé
 * (1/3 da largura) ou os banners deitados (1/2), e só o `layout` diz qual.
 */
export function variantBox(
  frames: readonly CropFrame[] = [],
  variant?: string,
  layout?: unknown,
): FrameBox {
  if (variant !== "collections") {
    return slotBox(frames)
  }

  return layout === "banners" ? slotBox(frames, 1 / 2) : slotBox(frames, 1 / 3)
}

const MIN_FRAME = 200

export function fitFrame(
  box: FrameBox,
  area: { width: number; height: number },
): { width: number; height: number } | undefined {
  const [w, h] = ratioOf(box).split("/").map(Number)

  if (!(w > 0 && h > 0) || area.width <= 0 || area.height <= 0) {
    return undefined
  }

  const width = Math.max(
    MIN_FRAME,
    Math.min(area.width - 32, ((area.height - 32) * w) / h),
  )

  return { width: Math.round(width), height: Math.round((width * h) / w) }
}

/** A proporção em `"16 / 9"`, para o `aspectRatio` do CSS. */
export function ratioOf(box: FrameBox): string {
  if (box.fit === "ratio") {
    return box.ratio.replace("/", " / ")
  }

  return box.fit === "height" ? `${SCREEN} / ${box.height}` : "24 / 10"
}

/** A mesma proporção como número (`w/h`), para entrar num `calc` do CSS. */
export function ratioValue(box: FrameBox): number {
  const [w, h] = ratioOf(box).split("/").map(Number)

  return w > 0 && h > 0 ? w / h : 24 / 10
}
