import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

import { resolveMediaUrl } from "@lib/util/media"

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
  /**
   * O card **do trilho** — e, depois do redesenho, este campo só escolhe o
   * `sizes` da foto, não a proporção dela.
   *
   * Ele nasceu decidindo a altura da caixa (4/5 no carrossel, 9/16 no catálogo),
   * e a régua do redesenho acabou com a segunda régua: **a foto é 3/4 em todo
   * lugar** em que a loja lista uma peça. O que continua valendo é a diferença de
   * **largura**: no trilho o card tem 76% da tela no celular, 40% de 512px a
   * 1023px e 30% de 1024px para cima (`.rv-carousel-item`, em `brand.css`), e no
   * catálogo ele é uma coluna da grade. `sizes` existe para o `next/image` servir
   * o arquivo do tamanho certo — mexer aqui sem mexer lá não quebra nada, só faz
   * a foto vir pixelada ou cara, sem ninguém ver de onde vem.
   *
   * O `isFeatured` do `product-preview` é o repasse deste campo: quem sabe que
   * está num trilho é a seção ("Peças em destaque", "Lançamentos").
   */
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
  const initialImage = resolveMediaUrl(thumbnail || images?.[0]?.url)

  /*
   * O hover é a **segunda** foto, e precisa passar pelo mesmo
   * `resolveMediaUrl` que a capa: sem isso, um produto com galeria (foto
   * enviada pelo painel) troca a capa — que carrega — por uma imagem que
   * devolve 500, e o hover passa a **mostrar o nada**. É a mesma falha da
   * galeria da PDP, no mesmo lugar: a URL absoluta do backend chegando ao
   * `next/image`.
   */
  const resolvedHover = resolveMediaUrl(hoverImage)

  return (
    <Container
      /*
       * A foto **sem moldura**. A classe `rv-thumb` existe para o card poder
       * dizer, no `brand.css`, a proporção e o fundo da caixa dele (`.rv-card-media
       * .rv-thumb`): a moldura que estava aqui — off-white da superfície, raio
       * grande, sombra e 1rem de respiro — sumiu de todos os lugares em que a loja
       * mostra uma peça, que é o que a régua do redesenho escreve (foto de borda a
       * borda, 3/4 no card e 1/1 na sacola e no pedido, onde o `size="square"`
       * manda). O que sobrou é o que a foto precisa em qualquer lugar: a caixa, o
       * corte e o recorte de cantos.
       */
      className={clx(
        "rv-thumb relative w-full overflow-hidden bg-rv-surface",
        className,
        {
          "aspect-[1/1]": size === "square",
          "aspect-[3/4]": size !== "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder
        image={initialImage}
        size={size}
        featured={isFeatured}
      />
      {resolvedHover && (
        <HoverImage image={resolvedHover} featured={isFeatured} />
      )}
    </Container>
  )
}

/**
 * Quanto a foto ocupa da tela, para o `next/image` escolher o arquivo — uma
 * constante por régua de card, e não um número solto dentro do componente.
 *
 * A do carrossel acompanha `.rv-carousel-item` (`brand.css`) à risca: 76% da
 * tela no celular, 40% de 512px a 1023px (dois cards e meio) e 30% de 1024px
 * para cima (três e um pedaço). Mexer na régua de lá sem mexer aqui não quebra
 * nada — só faz o `srcset` servir o arquivo de outro tamanho, e a foto fica cara
 * ou pixelada sem ninguém ver de onde vem.
 */
const FEATURED_SIZES = "(max-width: 511px) 76vw, (max-width: 1023px) 40vw, 30vw"
const CARD_SIZES =
  "(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"

/**
 * A segunda foto: por cima da capa, invisível até o mouse chegar no card.
 *
 * `aria-hidden` e `alt` vazio de propósito — a capa logo abaixo já descreve a
 * peça, e a mesma descrição duas vezes só faz o leitor de tela repetir. Sem
 * `"use client"` e sem estado: quem liga o efeito é o `group-hover` do card.
 *
 * `featured` só escolhe o `sizes` da foto (as réguas de card são diferentes); o
 * recuo de 1rem do card do carrossel fica na caixa do `Thumbnail`, e as duas
 * imagens — capa e hover — nascem dentro dela, no mesmo retângulo: senão a troca
 * no hover daria um pulo de 1rem na peça.
 */
const HoverImage = ({
  image,
  featured,
}: {
  image: string
  featured?: boolean
}) => (
  <Image
    src={image}
    alt=""
    aria-hidden="true"
    className="absolute inset-0 object-cover object-center opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
    draggable={false}
    quality={80}
    sizes={featured ? FEATURED_SIZES : CARD_SIZES}
    fill
  />
)

const ImageOrPlaceholder = ({
  image,
  size,
  featured,
}: Pick<ThumbnailProps, "size"> & { image?: string; featured?: boolean }) => {
  return image ? (
    <Image
      src={image}
      alt="Thumbnail"
      className="absolute inset-0 object-cover object-center"
      draggable={false}
      quality={80}
      sizes={featured ? FEATURED_SIZES : CARD_SIZES}
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
