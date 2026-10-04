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
   * O card **largo** da vitrine — a proporção 4/5 das seções em carrossel
   * ("Peças em destaque" e "Lançamentos"), em vez do retrato 9/16 do catálogo.
   *
   * O nome vem de "Peças em destaque", a primeira seção a usá-lo; quando
   * "Lançamentos" virou o mesmo carrossel, ela passou a pedir a mesma proporção —
   * duas réguas de altura na mesma dobra era o que menos parecia intenção. O
   * `isFeatured` do `product-preview` é o repasse deste campo.
   *
   * E é ele também que faz a foto **recuar** para dentro da moldura. A imagem é
   * `absolute inset-0` (ela *é* a face do card — o que o catálogo quer), mas no
   * carrossel isso engolia o `p-4` da moldura: a peça encostava no fio. O recuo
   * de 1rem (a caixa `inset-4` no retorno, logo abaixo) põe a foto exatamente
   * onde a moldura começa. **O chip de estado não está mais aqui**: ele desceu
   * para a linha do preço, no `product-preview`, e por isso o recuo deixou de
   * existir por causa dele — agora é respiro de desenho, não de encaixe.
   *
   * **A moldura é 4/5 (0,8), por escolha da loja** — era 11/14 (0,786).
   * Com o card de 30% da largura do desktop (432px), a 11/14 dava uma caixa de
   * 432 x 540px: três retratos altos que ocupavam a dobra inteira. A 4/5 dá
   * 432 x 540px também — a altura não muda, porque 4/5 e 11/14 têm quase a
   * mesma proporção — mas a peça fica **menos recortada**: a foto de catálogo
   * é 3/4 (0,75) e o `object-cover` agora corta por menos lado, em vez de
   * encostar a peça na borda superior.
   *
   * A troca real de altura vem da régua do trilho, não daqui: `.rv-carousel-item`
   * em `brand.css` decide a largura, e a proporção decide o resto.
   * O que continua valendo: o recuo de 1rem (`inset-4`, abaixo) é o que segura
   * a foto dentro da moldura. **A proporção da caixa da foto** é a da moldura
   * menos o recuo, e por isso muda com a largura do card — por isso este
   * comentário **não** traz mais a conta antiga: ela era da 11/14 e valeria
   * menos que zero aqui. Se o corte da foto virar problema, a conta se mede de
   * novo no navegador, no cartão que o desenho indica.
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
      className={clx(
        "relative w-full overflow-hidden p-4 bg-rv-surface shadow-[var(--rv-shadow-card)] rounded-[var(--rv-radius-lg)] group-hover:shadow-[var(--rv-shadow-card-hover)] transition-shadow ease-in-out duration-200",
        className,
        {
          "aspect-[4/5]": isFeatured,
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
      {isFeatured ? (
        /*
         * O card do carrossel: a foto mora **dentro** do respiro da moldura.
         *
         * A caixa, e não um `inset-4` na imagem: o `next/image` com `fill`
         * escreve `inset: 0` em **estilo inline**, e estilo inline ganha de
         * classe — pedir o recuo na própria foto não muda um pixel (medido no
         * navegador: a foto voltava a ocupar o card inteiro). Esta caixa é a
         * única do caminho sem estilo inline nenhum, e é ela que segura o
         * respiro.
         *
         * `inset-4` **é** o `p-4` da moldura, e não um valor de gosto: é o mesmo
         * 1rem que o chip de estado usa para se afastar do canto.
         */
        <div className="absolute inset-4">
          <ImageOrPlaceholder
            image={initialImage}
            size={size}
            featured={isFeatured}
          />
          {resolvedHover && (
            <HoverImage image={resolvedHover} featured={isFeatured} />
          )}
        </div>
      ) : (
        <>
          <ImageOrPlaceholder
            image={initialImage}
            size={size}
            featured={isFeatured}
          />
          {resolvedHover && (
            <HoverImage image={resolvedHover} featured={isFeatured} />
          )}
        </>
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
