/**
 * O enquadramento de imagem — `"<h>:<v>:<z>"` — e a moldura que o desenha.
 * O zoom é a foto crescendo na moldura (`100/z`), andando para o ponto ficar
 * no meio; sem zoom sai só o `objectPosition`. Doc 15.
 */
import type { SectionType } from "./contract.ts"

export const IMAGE_CROP_KIND = "imageCrop"

/** Dois eixos (`center` ou 0–100) e o zoom opcional de 1 a 3; `%` é aceito na leitura. */
export const CROP_PATTERN =
  "^(center|-?\\d{1,3}%?):(center|-?\\d{1,3}%?)(:([1-3](\\.\\d{1,2})?))?$"

export const CROP_ZOOM_MIN = 1

/** Acima de 3 a foto é um borrão de pixels na tela. */
export const CROP_ZOOM_MAX = 3

/** `center` ou o percentual inteiro do eixo. */
export type CropAxis = number | "center"

/** O ponto que fica no meio da moldura e o zoom — a leitura do `object-position`. */
export type Crop = {
  x: CropAxis
  y: CropAxis
  z: number
}

/** O recorte lido; `undefined` para vazio ou fora do padrão (vale a régua). */
export function parseCrop(value: unknown): Crop | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const text = value.trim()

  if (!new RegExp(CROP_PATTERN).test(text)) {
    return undefined
  }

  const [rawX, rawY, rawZ] = text.split(":")

  return {
    x: axis(rawX),
    y: axis(rawY),
    z: rawZ === undefined ? CROP_ZOOM_MIN : clampZoom(Number(rawZ)),
  }
}

/** O valor gravado; o zoom 1 não se escreve (`"center:34"`), para haver uma forma só. */
export function formatCrop(crop: Crop): string {
  const x = formatAxis(crop.x)
  const y = formatAxis(crop.y)
  const z = clampZoom(crop.z)

  return z === CROP_ZOOM_MIN ? `${x}:${y}` : `${x}:${y}:${trimZoom(z)}`
}

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) {
    return CROP_ZOOM_MIN
  }

  return Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, z))
}

/** O zoom com até duas casas: `1.4`, e não o `1.4000000000000001` do `pow`. */
export function trimZoom(z: number): string {
  return number(clampZoom(z))
}

/** Um número no CSS com até duas casas: `33.33`, e não `33.33333333333333`. */
function number(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function percent(axis: CropAxis): string {
  return axis === "center" ? "center" : `${axis}%`
}

/** Um eixo lido do texto, preso a 0–100 e arredondado. */
function axis(raw: string | undefined): CropAxis {
  if (!raw || raw === "center") {
    return "center"
  }

  return Math.min(100, Math.max(0, Math.round(Number(raw.replace("%", "")))))
}

function formatAxis(axis: CropAxis): string {
  return axis === "center" ? "center" : String(axis)
}

/** Um degrau da moldura: altura da seção (`height`) **ou** proporção da caixa. */
export type CropFrame = {
  label: string
  /** A largura de tela a partir da qual o degrau vale; o primeiro é o celular. */
  from: number
  height?: number
  ratio?: string
}

/** As molduras de uma seção: a da foto da seção e a da foto do item. */
export type CropFrames = {
  section?: readonly CropFrame[]
  item?: readonly CropFrame[]
}

/** Espelho declarado do `brand.css`; o `crop-frames.spec.ts` lê o CSS e compara. */
export const CROP_FRAMES: Record<string, CropFrames> = {
  hero: {
    section: [
      { label: "Celular", from: 0, height: 570 },
      { label: "Tela larga", from: 1024, height: 760 },
    ],
    item: [
      { label: "Celular", from: 0, height: 570 },
      { label: "Tela larga", from: 1024, height: 760 },
    ],
  },
  editorial: {
    section: [
      { label: "Celular", from: 0, ratio: "4/5" },
      { label: "Tela larga", from: 1024, ratio: "5/6" },
    ],
  },
  banner: {
    section: [
      { label: "Celular", from: 0, height: 520 },
      { label: "Tela larga", from: 1024, height: 600 },
    ],
  },
  collections: {
    section: [
      { label: "Celular", from: 0, height: 450 },
      { label: "Tablet", from: 560, height: 520 },
      { label: "Tela larga", from: 1024, height: 650 },
    ],
    item: [
      { label: "Celular", from: 0, height: 450 },
      { label: "Tablet", from: 560, height: 520 },
      { label: "Tela larga", from: 1024, height: 650 },
    ],
  },
  instagram: {
    section: [
      { label: "Celular", from: 0, ratio: "1/1" },
      { label: "Tela larga", from: 1024, ratio: "1/1" },
    ],
    item: [
      { label: "Celular", from: 0, ratio: "1/1" },
      { label: "Tela larga", from: 1024, ratio: "1/1" },
    ],
  },
}

/** Os `kind` de lista cuja foto de item é enquadrada. */
export type CropItemKind = "list:hero-slide" | "list:highlight" | "list:image"

/** O dono da moldura de cada lista, e como o CRM chama a foto dele. */
const ITEM_FRAME_OWNER: Record<
  CropItemKind,
  { section: SectionType; label: string }
> = {
  "list:hero-slide": { section: "hero", label: "slide" },
  "list:highlight": { section: "collections", label: "coleção" },
  "list:image": { section: "instagram", label: "foto" },
}

/** O tipo de seção dono de um `kind` de lista (`undefined` se a lista não tem foto). */
export function frameOwnerOf(kind: string): SectionType | undefined {
  return ITEM_FRAME_OWNER[kind as CropItemKind]?.section
}

/** Como o CRM chama a foto de um item ("slide", "coleção", "foto"). */
export function frameItemLabel(kind: string): string | undefined {
  return ITEM_FRAME_OWNER[kind as CropItemKind]?.label
}

/** As molduras da foto da seção; vazio para um tipo que não tem foto. */
export function sectionFrames(type: string): readonly CropFrame[] {
  return CROP_FRAMES[type]?.section ?? []
}

/** As molduras da foto de um item de lista; vazio se a lista não tem foto. */
export function itemFrames(kind: string): readonly CropFrame[] {
  const owner = frameOwnerOf(kind)

  return owner ? (CROP_FRAMES[owner].item ?? []) : []
}

/** Como a foto se encaixa na moldura: a altura da seção, uma proporção, ou o CSS. */
export type FrameBox =
  | { fit: "cover" }
  | { fit: "height"; height: number }
  | { fit: "ratio"; ratio: string }

/** A caixa em `width` (ausente = o maior degrau); sem degrau nenhum, o CSS manda. */
export function frameBox(
  frames: readonly CropFrame[] | undefined,
  width?: number
): FrameBox {
  if (!frames?.length) {
    return { fit: "cover" }
  }

  const vp = width === undefined ? Infinity : width
  const degrau = [...frames]
    .sort((a, b) => a.from - b.from)
    .reduce((atual, proximo) => (proximo.from <= vp ? proximo : atual))

  if (typeof degrau.height === "number") {
    return { fit: "height", height: degrau.height }
  }

  return degrau.ratio ? { fit: "ratio", ratio: degrau.ratio } : { fit: "cover" }
}

/** O estilo do recorte: `objectPosition` sempre, e o zoom como tamanho e deslocamento. */
export type CropImageStyle = {
  objectPosition: string
  position?: "absolute"
  top?: string
  left?: string
  width?: string
  height?: string
  maxWidth?: "none"
}

/** A conta única do zoom: a foto cresce (`100/z`) e anda para o ponto ficar no meio. */
export function cropImageStyle(crop: unknown): CropImageStyle | undefined {
  const parsed = parseCrop(crop)

  if (!parsed) {
    return undefined
  }

  const objectPosition = `${percent(parsed.x)} ${percent(parsed.y)}`
  const z = parsed.z

  if (z === CROP_ZOOM_MIN) {
    return { objectPosition }
  }

  // `center` cresce em torno do centro da caixa: deslocamento zero, e não um
  // número inventado.
  const shift = (axis: CropAxis) => {
    const value = ((axis === "center" ? 0.5 : axis / 100) * (z - 1) * 100) / z

    return value === 0 ? "0%" : `-${number(value)}%`
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

/** A foto cabe inteira? O CRM avisa antes de gravar um zoom que a moldura corta. */
export function cropFitsBox(crop: unknown, box: FrameBox): boolean {
  const parsed = parseCrop(crop)

  return !parsed || parsed.z === CROP_ZOOM_MIN || box.fit === "height"
}
