/**
 * O que `POST /admin/uploads` aceita — e a recusa, com motivo.
 */

/** Os tetos, em bytes: os dois campos têm usos distintos. */
export const LIMITE_IMAGEM = 8 * 1024 * 1024
export const LIMITE_DOCUMENTO = 25 * 1024 * 1024

/** O teto de qualquer envio — o do documento, que é o que o `multer` corta. */
export const LIMITE_ABSOLUTO = LIMITE_DOCUMENTO

/** Os tipos aceitos, por família, com o teto de cada um. */
const ACEITOS = {
  image: {
    limite: LIMITE_IMAGEM,
    tipos: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
    rotulo: "imagem",
  },
  document: {
    limite: LIMITE_DOCUMENTO,
    tipos: ["application/pdf"],
    rotulo: "documento",
  },
} as const

type Familia = keyof typeof ACEITOS

export type ArquivoEnviado = {
  originalname?: string
  mimetype?: string
  size?: number
}

export function recusaDoEnvio(arquivo: ArquivoEnviado): string | undefined {
  const tipo = (arquivo.mimetype ?? "").toLowerCase()
  const familia = familiaDoTipo(tipo)

  if (!familia) {
    return `Tipo de arquivo não permitido: ${tipo || "desconhecido"}. Aceitos: JPEG, PNG, WebP, AVIF, GIF e PDF.`
  }

  const { limite, tipos, rotulo } = ACEITOS[familia]

  // `image/*` não passa: o `mimetype` é do cliente, e a lista aceita o que ele
  // diz ser — sem curinga.
  if (!(tipos as readonly string[]).includes(tipo)) {
    return `Tipo de arquivo não permitido: ${tipo}. Aceitos para ${rotulo}: ${tipos.join(", ")}.`
  }

  const tamanho = arquivo.size ?? 0

  if (tamanho > limite) {
    return `O arquivo ${nomeDoArquivo(arquivo)} tem ${emMegabytes(tamanho)} MB e o limite para este tipo é ${emMegabytes(limite)} MB.`
  }

  return undefined
}

function familiaDoTipo(tipo: string): Familia | undefined {
  if (tipo === "application/pdf") {
    return "document"
  }

  return tipo.startsWith("image/") ? "image" : undefined
}

function nomeDoArquivo(arquivo: ArquivoEnviado): string {
  const nome = (arquivo.originalname ?? "").trim()
  return nome ? `"${nome}"` : ""
}

/** Bytes em MB com uma casa: o número é para ler, não calcular. */
function emMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

