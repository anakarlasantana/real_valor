import { resolveMediaUrl } from "@lib/util/media"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

/**
 * A galeria da página da peça.
 *
 * **A primeira foto ocupa a largura toda; as outras entram duas a duas.** É o
 * desenho do redesenho, e ele resolve um problema real de quem vende roupa: a
 * foto inteira é a peça, e as seguintes são detalhe (o tecido, as costas, o
 * acabamento). Em grade de iguais, a primeira — a única que o catálogo tem hoje —
 * perderia metade da largura para um espaço vazio ao lado.
 *
 * O quadro é do CSS (`.rv-product-gallery`, em `brand.css`), e por isso o
 * componente não escreve tamanho nenhum: a altura da foto principal e das
 * secundárias é decisão de desenho, e não deste arquivo.
 *
 * O que **não** foi portado: o bloco rosado com a frase em letra manuscrita que a
 * referência põe no meio da grade. Ele é decoração — não vem de dado nenhum —, e
 * o catálogo tem **uma foto por peça**: o bloco existiria para tapar o buraco de
 * uma grade que não tem o que preencher, dizendo uma frase que não fala da peça.
 * Quando houver galeria de verdade, o segundo quadro recebe a segunda foto.
 */
const ImageGallery = ({ images }: ImageGalleryProps) => {
  return (
    <div className="rv-product-gallery">
      {images.map((image, index) => {
        /*
         * `resolveMediaUrl` não é um enfeite: a foto que a cliente enviou pelo
         * painel é gravada com a URL **absoluta do backend**
         * (`http://localhost:9000/static/<chave>`), e é a que o `next/image`
         * receberia aqui.
         *
         * O otimizador de imagem não repassa o pedido — ele **busca**, redimensiona
         * e devolve. Quem busca é o processo do storefront, dentro do container
         * dele, e `localhost` ali é o próprio container: a otimização falhava com
         * `ECONNREFUSED` e a foto não aparecia. Medido, com uma foto enviada pelo
         * painel: `/_next/image?url=http%3A%2F%2Flocalhost%3A9000%2Fstatic%2F...`
         * → **HTTP 500**, enquanto o mesmo arquivo no caminho `/uploads/` → 200.
         *
         * A função converte a URL do backend em `/uploads/<chave>`, que é
         * reescrito para o endereço **interno** do backend (`MEDUSA_BACKEND_URL`,
         * `next.config.js`). Por isso o dado já gravado não precisa migrar: quem
         * muda é o que o storefront pede.
         */
        const src = resolveMediaUrl(image.url)

        return (
          <div
            key={image.id}
            id={image.id}
            className={index === 0 ? "rv-gallery-main" : "rv-gallery-item"}
          >
            {src && (
              <Image
                src={src}
                priority={index === 0}
                className="object-cover"
                alt={`Foto ${index + 1} de ${images.length} do produto`}
                fill
                sizes="(max-width: 1023px) 100vw, 60vw"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ImageGallery

