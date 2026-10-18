/**
 * Campo de imagem (`kind: "image"`): a prévia na moldura da seção, o envio e o
 * valor gravado (a caixa aceita caminho ou URL colada).
 *
 * O que se grava é a CHAVE do arquivo, nunca a URL do backend: quem traduz
 * chave → endereço é o storefront. A prévia usa `/static/<chave>`, que responde
 * nos dois endereços do painel (§11.6.2 de `docs/real-valor/11-ambiente-local.md`).
 */
import { Button, Input, Text, toast } from "@medusajs/ui"
import type { CropFrame } from "@conteudo/crop"
import { useRef, useState } from "react"

import { apiUrl } from "../../../lib/api-url"
import type { CropHelp } from "./crop-field"
import { CropFrame as PreviewFrame } from "./crop-frame"
import { CropPreview } from "./crop-preview"
import { ImageCropModal } from "./image-crop-modal"
import { variantBox, type FrameBox } from "../lib/crop-window"

/** O que `POST /admin/uploads` devolve por arquivo (a chave vem no `id`). */
type UploadedFile = { id: string; url: string }

/** Teto do envio, conferido antes de subir: o multipart do Medusa custa memória. */
const MAX_BYTES = 8 * 1024 * 1024

/** As frases do modal, quando o payload não as traz (`schema.crop.help`). */
const FALLBACK_HELP = {
  gesture: "Arraste a foto e use o zoom para escolher o enquadramento.",
  ratioZoom:
    "Esta moldura tem proporção fixa: com zoom, a foto não cabe inteira.",
  reset: "Voltar ao padrão",
}

export const ImageInput = ({
  value,
  onChange,
  crop,
  onCropChange,
  frames = [],
  variant,
  layout,
  cropHelp,
}: {
  value: unknown
  onChange: (value: string) => void
  /** O recorte gravado (`"<h>:<v>:<z>"`), irmão do `imageUrl` no mesmo objeto. */
  crop?: unknown
  /** Grava o recorte. Sem ele o campo não oferece o enquadramento. */
  onCropChange?: (value: string) => void
  /** As molduras da seção (`schema.cropFrames`): a prévia tem a forma da loja. */
  frames?: readonly CropFrame[]
  /** `schema.crop`: o teto do zoom e as frases do modal. */
  cropHelp?: CropHelp
  /** A seção e o formato dela (`collections`: `cards` ou `banners`). */
  variant?: string
  layout?: unknown
}) => {
  const stored = typeof value === "string" ? value : ""
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const preview = fresh ?? previewFromValue(stored)
  const editable = typeof onCropChange === "function" && frames.length > 0
  const box: FrameBox = variantBox(frames, variant, layout)

  /** Editar à mão descarta a URL do último envio: ela não vale mais. */
  const edit = (next: string) => {
    setFresh(null)
    onChange(next)
  }

  const send = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(
        `A imagem tem ${inMegabytes(file.size)} MB e o limite é ${inMegabytes(
          MAX_BYTES,
        )} MB.`,
      )
      return
    }

    setBusy(true)

    try {
      const body = new FormData()
      body.append("files", file)

      // O envio sai pelo `apiUrl`: publicado pelo storefront, "/admin/uploads"
      // não chega à API (ver `src/admin/lib/api-url.ts`).
      const res = await fetch(apiUrl("/admin/uploads"), {
        method: "POST",
        credentials: "include",
        body,
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao enviar a imagem.")
        return
      }

      const uploaded = ((json.files ?? []) as UploadedFile[])[0]

      if (!uploaded?.id) {
        toast.error("O envio não devolveu a chave do arquivo.")
        return
      }

      setFresh(uploaded.url || null)
      onChange(uploaded.id)
      toast.success("Imagem enviada.")
    } catch (error) {
      toast.error("Falha ao enviar a imagem.")
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start gap-x-3">
      {preview ? (
        // A prévia na moldura da seção: o recorte na forma em que a loja o desenha.
        <div className={frames.length > 0 ? "w-40 shrink-0" : "contents"}>
          {frames.length > 0 ? (
            <PreviewFrame
              box={box}
              className="rounded-md border border-ui-border-base"
            >
              <CropPreview src={preview} crop={crop} />
            </PreviewFrame>
          ) : (
            <img
              src={preview}
              alt=""
              className="h-16 w-16 shrink-0 rounded-md border border-ui-border-base object-cover"
            />
          )}
        </div>
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-md border border-dashed border-ui-border-base" />
      )}

      <div className="flex flex-1 flex-col gap-y-2">
        <Input
          value={stored}
          placeholder="1699999999-hero.jpg ou /brand/hero.jpg"
          onChange={(e) => edit(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          O campo guarda a chave do arquivo enviado (ou um caminho do site /
          URL); a loja publica a chave em /uploads.
        </Text>

        {editable && (
          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              disabled={!preview}
              onClick={() => setCropping(true)}
            >
              Ajustar enquadramento
            </Button>
            {typeof crop === "string" && crop !== "" && (
              <Button
                variant="transparent"
                size="small"
                onClick={() => onCropChange?.("")}
              >
                Limpar
              </Button>
            )}
            <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
              {typeof crop === "string" && crop ? crop : "automático"}
            </Text>
          </div>
        )}
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]

          // Zera o input para o MESMO arquivo poder ser reenviado.
          e.target.value = ""
          if (file) {
            void send(file)
          }
        }}
      />

      <div className="flex shrink-0 flex-col gap-y-2">
        <Button
          variant="secondary"
          size="small"
          isLoading={busy}
          onClick={() => picker.current?.click()}
        >
          Enviar imagem
        </Button>
        {stored && (
          <Button variant="transparent" size="small" onClick={() => edit("")}>
            Remover
          </Button>
        )}
      </div>

      {editable && preview && (
        <ImageCropModal
          open={cropping}
          target={{ box, crop, src: preview }}
          help={cropHelp ?? { help: FALLBACK_HELP }}
          onClose={() => setCropping(false)}
          onSave={(next) => onCropChange?.(next)}
        />
      )}
    </div>
  )
}

/** O `src` da prévia: caminho e URL passam como estão; o resto é chave. */
function previewFromValue(value: string): string | undefined {
  const src = value.trim()

  if (!src) {
    return undefined
  }

  if (src.startsWith("/") || /^[a-z][a-z0-9+.-]*:\/\//i.test(src)) {
    return src
  }

  return `/static/${src}`
}

/** Bytes em MB com uma casa: a mensagem existe para ser lida, não calculada. */
function inMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}
