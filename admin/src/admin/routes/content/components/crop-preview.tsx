/** A prévia do recorte, com a conta do contrato (`cropImageStyle`) — a da loja. */
import { cropImageStyle } from "../lib/crop-window"

export function CropPreview({
  src,
  crop,
  alt = "",
  className = "",
  onError,
}: {
  /** O endereço da foto (a chave já resolvida em `/static/...`). */
  src: string
  /** O valor gravado (`"<h>:<v>:<z>"`) — vazio desenha a foto inteira. */
  crop: unknown
  alt?: string
  className?: string
  /** A foto não carregou: quem mostra a moldura decide o que dizer. */
  onError?: () => void
}) {
  const style = cropImageStyle(crop)

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`h-full w-full object-cover ${className}`}
      style={style}
      onError={onError}
    />
  )
}
