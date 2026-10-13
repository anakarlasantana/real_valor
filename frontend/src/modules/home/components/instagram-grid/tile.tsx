import { type InstagramSection } from "@lib/content/home-sections"
import { mediaImageProps } from "@lib/util/media"
import Image from "next/image"

/** Uma foto da lista da seção — o par que o CRM grava. */
export type InstagramImage = InstagramSection["images"][number]

/**
 * O quadro quadrado da seção — o mesmo na faixa e na grade parada.
 *
 * Este arquivo **não** é de cliente nem de servidor: quem decide a largura é o
 * container de quem ele é filho (`brand.css`, `.rv-insta-tile`), e por isso ele
 * serve aos dois. A faixa é uma ilha de cliente (`./strip.tsx`, que precisa do
 * gesto) e a grade de uma foto só é servidor (`./index.tsx`, que não precisa de
 * nada); com o quadro num módulo só, o desenho é um, e os dois lados desenham o
 * mesmo quadrado.
 *
 * Só `imageUrl` cru poderia não virar `src` (ver `lib/util/media.ts`, em
 * `mediaImageProps`): o quadro continua no lugar, com o fundo cacao da régua,
 * para a faixa não desmontar por causa de um item vazio.
 */
export function InstagramTile({ image }: { image: InstagramImage }) {
  const media = mediaImageProps(image.imageUrl)

  return (
    <li className="rv-insta-tile">
      {media && (
        <Image
          {...media}
          alt={image.imageAlt}
          fill
          sizes="(min-width: 1440px) 340px, 24vw"
          className="object-cover object-center"
          /*
           * A foto não é o que se arrasta: o gesto é da faixa (`./strip.tsx`). Sem
           * isto o navegador pega a imagem (o `dragstart` nativo, com a miniatura
           * fantasma atrás do cursor) e o nosso `pointermove` para no meio.
           */
          draggable={false}
        />
      )}
    </li>
  )
}
