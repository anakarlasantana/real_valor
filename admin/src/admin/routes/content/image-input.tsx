/**
 * Campo de imagem do editor de conteúdo (`kind: "image"`).
 * -------------------------------------------------------------------------
 * Três coisas juntas, porque separá-las é o que faz o lojista se perder:
 * a prévia (para ele ver o que a loja mostra), o envio (o botão) e o valor
 * gravado (a caixa de texto, que continua aceitando um caminho ou uma URL
 * colada à mão — é assim que o conteúdo padrão aponta para `/brand/...`).
 *
 * **O que é gravado é a CHAVE do arquivo** (`1699999999-hero.jpg`), o `id` que
 * `POST /admin/uploads` devolve — e não a URL absoluta do backend. A URL tem o
 * endereço de quem respondeu o upload dentro dela; gravada, o conteúdo
 * passaria a apontar para `http://localhost:9000` e quebraria no dia em que a
 * loja for para outro domínio. Quem traduz chave → endereço é o storefront
 * (`resolveMediaUrl`, em `frontend/src/lib/util/media.ts`) — e é por isso que
 * este arquivo não precisa saber o endereço do backend para a prévia: o painel
 * é servido PELO backend, então `/static/<chave>` resolve aqui dentro.
 */
import { Button, Input, Text, toast } from "@medusajs/ui"
import { useRef, useState } from "react"

/**
 * O que `POST /admin/uploads` devolve por arquivo (`file-module-service` põe a
 * chave do provider no `id`).
 */
type UploadedFile = { id: string; url: string }

/**
 * Teto do envio, conferido ANTES de subir: o arquivo vai em base64 dentro de
 * um multipart que o Medusa monta em memória (`upload.array` no middleware de
 * `/admin/uploads`), então o custo no backend é maior que o arquivo. Foto de
 * vitrine é imagem para a web: 8 MB já é generoso para um hero em tela grande,
 * e é melhor recusar com uma frase do que travar o navegador de quem escolheu
 * a foto errada.
 */
const MAX_BYTES = 8 * 1024 * 1024

export const ImageInput = ({
  value,
  onChange,
}: {
  value: unknown
  onChange: (value: string) => void
}) => {
  const stored = typeof value === "string" ? value : ""

  /**
   * A URL que o envio acabou de devolver, só para a prévia. Fica fora do valor
   * gravado de propósito: é dado do momento, não conteúdo — e depois de salvar
   * a página recarrega o rascunho do servidor, quando a prévia volta a ser
   * derivada da chave.
   */
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const preview = fresh ?? previewFromValue(stored)

  /** Editar à mão descarta a URL do último envio: ela não vale mais. */
  const edit = (next: string) => {
    setFresh(null)
    onChange(next)
  }

  const send = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(
        `A imagem tem ${inMegabytes(file.size)} MB e o limite é ${inMegabytes(
          MAX_BYTES
        )} MB.`
      )
      return
    }

    setBusy(true)

    try {
      const body = new FormData()
      body.append("files", file)

      // `fetch` relativo como o resto da página (`/admin/content`): o painel é
      // servido pelo próprio backend, então a sessão do admin vai no cookie.
      const res = await fetch("/admin/uploads", {
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
        <img
          src={preview}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md border border-ui-border-base object-cover"
        />
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
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Zera o input para o MESMO arquivo poder ser reenviado: o navegador
          // não dispara `change` de novo com o mesmo valor selecionado.
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
    </div>
  )
}

/**
 * O `src` da prévia a partir do valor gravado.
 *
 * O painel é servido pelo backend, então a rota `/static/<chave>` resolve no
 * mesmo origem daqui — esta é a diferença em relação ao storefront, que serve
 * a mesma imagem em `/uploads/...` (o rewrite do `next.config.js`). Um valor
 * que já é caminho (`/brand/...`) ou URL passa como está; o resto é chave.
 */
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
