import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import Image from "next/image"

import { resolveMediaUrl } from "@lib/util/media"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {images.map((image, index) => {
          /*
           * `resolveMediaUrl` não é um enfeite: a foto que a cliente enviou pelo
           * painel é gravada com a URL **absoluta do backend**
           * (`http://localhost:9000/static/<chave>`), e é a que o
           * `next/image` receberia aqui.
           *
           * O otimizador de imagem não repassa o pedido — ele **busca**, redimensiona
           * e devolve. Quem busca é o processo do storefront, dentro do container
           * dele, e `localhost` ali é o próprio container: a Optimização falhava
           * com `ECONNREFUSED` e a foto não aparecia. Medido, com uma foto enviada
           * pelo painel: `/_next/image?url=http%3A%2F%2Flocalhost%3A9000%2Fstatic%2F...`
           * → **HTTP 500**, enquanto o mesmo arquivo no caminho `/uploads/` → 200.
           *
           * A função converte a URL do backend em `/uploads/<chave>`, que é
           * reescrito para o endereço **interno** do backend (`MEDUSA_BACKEND_URL`,
           * `next.config.js`) — o mesmo endereço que o resto da loja já usa
           * (`resolveMediaUrl` está nos componentes da home). Por isso o dado já
           * gravado não precisa migrar: quem muda é o que o storefront pede.
           */
          const src = resolveMediaUrl(image.url)

          return (
            <Container
              key={image.id}
              className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
              id={image.id}
            >
              {src && (
                <Image
                  src={src}
                  priority={index <= 2 ? true : false}
                  className="absolute inset-0 rounded-rounded"
                  alt={`Foto ${index + 1} de ${images.length} do produto`}
                  fill
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                  style={{
                    objectFit: "cover",
                  }}
                />
              )}
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
