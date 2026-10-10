/**
 * Campo de documento do editor de conteúdo (`kind: "document"`).
 * -------------------------------------------------------------------------
 * Um arquivo que a loja **não desenha**: ela publica um botão que baixa. É o
 * mesmo envio da imagem — `POST /admin/uploads`, a **chave** gravada —, e o que
 * muda é o que se vê: no lugar da prévia, a caixa com o caminho do arquivo, que
 * é a única coisa que o lojista confere sem abrir o PDF.
 *
 * **Por que a chave, e não a URL** (`1699999999-aviso.pdf`, e não
 * `http://localhost:9000/static/...`): a mesma razão do `ImageInput` — a URL
 * absoluta tem o endereço de quem respondeu o upload dentro dela, e o conteúdo
 * passaria a apontar para `localhost` no dia em que a loja mudar de domínio.
 * Quem traduz chave → endereço é o storefront (`resolveMediaUrl`).
 *
 * **O teto de 25 MB é conferido antes de subir**, e é a decisão 10 de 14.14 —
 * de conteúdo e de custo, tomada pelo negócio: o multipart de `/admin/uploads` é
 * montado **em memória** no backend, então o custo de um arquivo grande não é o
 * arquivo, é o processo que o recebe. 25 MB é uma ordem de grandeza acima da
 * foto de vitrine (8 MB) e cobre um contrato escaneado em boa qualidade, que é o
 * caso deste campo.
 *
 * ⚠️ **O que este campo não checa: o conteúdo do arquivo.** O valor gravado é a
 * chave que o provider devolveu — a API não vê o arquivo, e quem escolhe é o
 * navegador do lojista (`accept="application/pdf"`). Um `curl` direto em
 * `/admin/uploads` com outro tipo gravaria a chave dele do mesmo jeito, e o
 * que a loja faria é publicar o botão com o rótulo do conteúdo. É o mesmo
 * arranjo do campo de imagem (o `accept="image/*"` também é do escolhedor), e é
 * a razão de a decisão 10 ser de **conteúdo**: quem sobe é a loja.
 */
import { Button, Input, Text, toast } from "@medusajs/ui"
import { useRef, useState } from "react"

/**
 * O que `POST /admin/uploads` devolve por arquivo (`file-module-service` põe a
 * chave do provider no `id`).
 */
type UploadedFile = { id: string; url: string }

/** O teto do envio, em bytes — ver o cabeçalho (decisão 10 de 14.14). */
const MAX_BYTES = 25 * 1024 * 1024

/** O tipo que o escolhedor de arquivos oferece. */
const ACCEPT = "application/pdf"

export const DocumentInput = ({
  value,
  onChange,
}: {
  value: unknown
  onChange: (value: string) => void
}) => {
  const stored = typeof value === "string" ? value : ""
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const send = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(
        `O arquivo tem ${inMegabytes(file.size)} MB e o limite é ${inMegabytes(
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
        toast.error(json.message ?? "Falha ao enviar o arquivo.")
        return
      }

      const uploaded = ((json.files ?? []) as UploadedFile[])[0]

      if (!uploaded?.id) {
        toast.error("O envio não devolveu a chave do arquivo.")
        return
      }

      onChange(uploaded.id)
      toast.success("PDF enviado.")
    } catch (error) {
      toast.error("Falha ao enviar o arquivo.")
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start gap-x-3">
      <div className="flex flex-1 flex-col gap-y-2">
        <Input
          value={stored}
          placeholder="1699999999-aviso.pdf ou /brand/aviso.pdf"
          onChange={(e) => onChange(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          {stored
            ? `Arquivo: ${stored}. `
            : "Nenhum arquivo — o botão de baixar não aparece na loja. "}
          O campo guarda a chave do arquivo enviado (ou um caminho do site / uma
          URL); a loja publica a chave em /uploads.
        </Text>
      </div>

      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
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
          Enviar PDF
        </Button>
        {stored && (
          <Button variant="transparent" size="small" onClick={() => onChange("")}>
            Remover
          </Button>
        )}
      </div>
    </div>
  )
}

/** Bytes em MB com uma casa: a mensagem existe para ser lida, não calculada. */
function inMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}
