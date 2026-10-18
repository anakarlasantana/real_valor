/** O modal de enquadramento: **uma** janela, no maior tamanho que cabe. */
import { Button, FocusModal, Text } from "@medusajs/ui"
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react"

import { CropFrame as Frame } from "./crop-frame"
import { CropPreview } from "./crop-preview"
import type { CropHelp, CropTarget } from "./crop-field"
import {
  CENTER_CROP,
  ZOOM_MIN,
  clampZoom,
  cropFitsBox,
  cropFromPoint,
  cropOf,
  fitFrame,
  parseCrop,
  stepCrop,
  valueOf,
  zoomCrop,
  type CropPoint,
} from "../lib/crop-window"

/** O recorte como ponto da moldura: o `center` é o meio da caixa. */
function axisValue(axis: number | "center"): number {
  return axis === "center" ? 50 : axis
}

export function ImageCropModal({
  open,
  target,
  help,
  onClose,
  onSave,
}: {
  open: boolean
  /** A caixa do componente, a foto e o que ele desenha sobre ela. */
  target: CropTarget & { src: string }
  /** `schema.crop`: o teto do zoom e as frases (`help.gesture`/`ratioZoom`/`reset`). */
  help: CropHelp
  onClose: () => void
  onSave: (value: string) => void
}) {
  const [crop, setCrop] = useState(() => cropOf(target.crop))
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState<{ width: number; height: number }>()
  const drag = useRef<{ point: CropPoint; crop: CropPoint; z: number } | null>(
    null,
  )
  const stage = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const zoomMax = help.zoomMax ?? 3
  const box = target.box

  // Cada abertura parte do valor gravado: fechar sem salvar não deixa resíduo.
  useEffect(() => {
    if (open) {
      setCrop(cropOf(target.crop))
      setFailed(false)
    }
  }, [open, target.crop])

  // A foto é do arquivo: trocar o endereço recomeça a espera pela carga.
  useEffect(() => setFailed(false), [target.src])

  // O palco mede a moldura.
  useEffect(() => {
    const node = area.current

    if (!open || !node) {
      return
    }

    const measure = () =>
      setSize(
        fitFrame(box, { width: node.clientWidth, height: node.clientHeight }),
      )
    const watch = new ResizeObserver(measure)

    watch.observe(node)
    measure()

    return () => watch.disconnect()
  }, [open, box])

  // O aviso de zoom só vale onde a caixa tem proporção fixa: nos degraus de
  // altura ele falaria de telas que não são desta seção.
  const fits = cropFitsBox(valueOf(crop), box) || box.fit !== "ratio"

  /** O ponto da moldura sob o ponteiro, em % da caixa. */
  const pointOf = (event: { clientX: number; clientY: number }): CropPoint => {
    const rect = stage.current?.getBoundingClientRect()

    return rect
      ? {
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        }
      : { x: 50, y: 50 }
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = parseCrop(valueOf(crop)) ?? {
      x: "center",
      y: "center",
      z: 1,
    }

    // Parte do eixo gravado (não do dedo): com zoom, o dedo puxaria a foto.
    drag.current = {
      point: pointOf(event),
      crop: { x: axisValue(start.x), y: axisValue(start.y) },
      z: start.z,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current

    if (!start) {
      return
    }

    // Um passo por evento, do ponto anterior: a rolagem não reancora o gesto.
    const now = pointOf(event)

    start.crop = {
      x: start.crop.x + (now.x - start.point.x),
      y: start.crop.y + (now.y - start.point.y),
    }
    start.point = now
    setCrop(cropFromPoint(start.crop, start.z))
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setCrop(zoomCrop(crop, crop.z + (event.deltaY < 0 ? 0.05 : -0.05)))
  }

  const reset = () => setCrop({ ...CENTER_CROP })

  return (
    <FocusModal open={open} onOpenChange={(next) => !next && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <Text weight="plus">Enquadramento da imagem</Text>
        </FocusModal.Header>

        {/* O `Body` é `flex-1` do `Content` (`fixed inset-2 flex-col`). */}
        <FocusModal.Body className="flex min-h-0 flex-1 flex-col gap-y-3 p-4">
          <div
            ref={area}
            className="flex min-h-0 flex-1 items-center justify-center"
            // `size` e não `inline-size`: a moldura lê a ALTURA em `100cqh`.
            style={{ containerType: "size" }}
          >
            <Frame
              box={box}
              size={size}
              ratioLocked={box.fit === "ratio"}
              className="cursor-move touch-none select-none"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onDoubleClick={reset}
              onWheel={onWheel}
            >
              <div ref={stage} className="absolute inset-0">
                {failed ? (
                  <div className="flex h-full flex-col justify-center gap-y-1 p-4">
                    <Text size="small" weight="plus">
                      Não foi possível carregar esta imagem.
                    </Text>
                    <Text size="xsmall" className="break-all text-ui-fg-subtle">
                      {target.src}
                    </Text>
                  </div>
                ) : (
                  <CropPreview
                    src={target.src}
                    crop={valueOf(crop)}
                    onError={() => setFailed(true)}
                  />
                )}
              </div>
            </Frame>
          </div>

          <div className="flex shrink-0 items-center gap-x-3">
            <Button
              size="small"
              variant="secondary"
              aria-label="Diminuir o zoom"
              onClick={() => setCrop(stepCrop(crop, -1))}
            >
              −
            </Button>
            <input
              type="range"
              aria-label="Zoom"
              min={ZOOM_MIN}
              max={zoomMax}
              step={0.05}
              value={crop.z}
              onChange={(e) => setCrop(zoomCrop(crop, Number(e.target.value)))}
              className="w-full max-w-sm"
            />
            <Button
              size="small"
              variant="secondary"
              aria-label="Aumentar o zoom"
              onClick={() => setCrop(stepCrop(crop, 1))}
            >
              +
            </Button>
            <Text size="small" className="w-12 tabular-nums">
              {clampZoom(crop.z).toFixed(2)}×
            </Text>
          </div>

          <div className="flex shrink-0 items-start justify-between gap-x-4">
            <div className="flex flex-col gap-y-1">
              <Text size="small" className="text-ui-fg-subtle">
                {help.help?.gesture}
              </Text>
              {!fits && (
                <Text size="small" className="text-ui-fg-warning">
                  {help.help?.ratioZoom}
                </Text>
              )}
            </div>

            {target.note && !failed && (
              <div className="hidden max-w-xs shrink-0 items-center gap-x-3 md:flex">
                <Frame box={box} className="h-14 w-24 shrink-0">
                  <CropPreview src={target.src} crop={valueOf(crop)} />
                </Frame>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {target.note}
                </Text>
              </div>
            )}
          </div>
        </FocusModal.Body>

        <FocusModal.Footer>
          <div className="flex w-full items-center justify-between gap-x-2">
            <Button variant="transparent" size="small" onClick={reset}>
              {help.help?.reset}
            </Button>
            <div className="flex gap-x-2">
              <Button variant="secondary" size="small" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                size="small"
                onClick={() => {
                  onSave(valueOf(crop))
                  onClose()
                }}
              >
                Usar este enquadramento
              </Button>
            </div>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
