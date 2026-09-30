import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  /**
   * A segunda foto do produto, quando existe: entra por cima no hover do card
   * (`group-hover`, do `product-preview`), e o que se vê é a peça na outra pose
   * — o mesmo gesto do site de referência.
   *
   * É prop, e não algo que este componente deduza de `images`: trocar a foto no
   * hover é comportamento **do card**, e quem desenha miniatura de carrinho, de
   * pedido ou de busca não pediu isso. O que o card passa é a primeira imagem
   * que não é a capa.
   *
   * Custo assumido: existindo a segunda foto, o navegador baixa as duas (a de
   * cima nasce com `opacity-0`, que não impede o carregamento). Com o catálogo
   * medido — **uma imagem por produto** — isso é zero requisição a mais hoje; se
   * um dia o catálogo tiver galeria cheia e o card ficar pesado, o caminho é
   * montar a segunda imagem só depois do primeiro hover, e aí o card deixa de
   * ser servidor.
   */
  hoverImage?: string | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  hoverImage,
  size = "small",
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 bg-rv-surface shadow-[var(--rv-shadow-card)] rounded-[var(--rv-radius-lg)] group-hover:shadow-[var(--rv-shadow-card-hover)] transition-shadow ease-in-out duration-200",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} />
      {hoverImage && <HoverImage image={hoverImage} />}
    </Container>
  )
}

/**
 * A segunda foto: por cima da capa, invisível até o mouse chegar no card.
 *
 * `aria-hidden` e `alt` vazio de propósito — a capa logo abaixo já descreve a
 * peça, e a mesma descrição duas vezes só faz o leitor de tela repetir. Sem
 * `"use client"` e sem estado: quem liga o efeito é o `group-hover` do card.
 */
const HoverImage = ({ image }: { image: string }) => (
  <Image
    src={image}
    alt=""
    aria-hidden="true"
    className="absolute inset-0 object-cover object-center opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
    draggable={false}
    quality={80}
    sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
    fill
  />
)

const ImageOrPlaceholder = ({
  image,
  size,
}: Pick<ThumbnailProps, "size"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="Thumbnail"
      className="absolute inset-0 object-cover object-center"
      draggable={false}
      quality={80}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
