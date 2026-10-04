import { getProductPrice } from "@lib/util/get-product-price"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductStatusChip from "../product-status-chip"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

/**
 * O card de produto — a peça em todos os lugares em que a loja a lista (vitrine
 * da home, trilho de lançamentos, catálogo, relacionados).
 *
 * Duas coisas acontecem aqui além do título e do preço:
 *
 *   1. **O chip de estado** ("Pronta entrega", "Últimas peças"…) sobreposto à
 *      foto. Quem decide qual é `productStatus`
 *      (`lib/util/product-availability.ts`), a mesma função que a página do
 *      produto usa — o card e a página não podem discordar.
 *   2. **A segunda foto no hover**, quando o produto tem mais de uma. O
 *      catálogo hoje tem **uma imagem por produto** (medido na Store API),
 *      então na prática o card não troca nada; a peça está aqui e passa a
 *      funcionar sozinha quando o catálogo tiver galeria.
 *   3. **O convite, sempre visível — e com cara de convite.** O "Comprar" era
 *      `opacity-0` até o ponteiro chegar, e no celular não existe hover: o
 *      caminho para a peça não existia para quem navega no toque — que é a
 *      maioria de quem abre a vitrine. Ele voltou a ser visível, mas ainda como
 *      uma linha de letra miúda; hoje é o **botão** que fecha o card
 *      (`.rv-card-cta`, em `brand.css`) e o preço acima dele é o número em preto
 *      do bloco (`.rv-price`). Quem mede as duas cores é o `brand.css` — é o
 *      arquivo que responde à regra de acessibilidade da marca.
 *
 * O card **não sabe** que está num carrossel: quem o apaga quando o ponteiro
 * aponta o vizinho é o CSS do trilho (`.rv-carousel`, em `brand.css`), e quem
 * mede a página é a ilha (`product-carousel/index.tsx`). Aqui só mora o que o
 * card é em qualquer lugar em que a loja o liste.
 */
export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  const cover = product.thumbnail || product.images?.[0]?.url
  const hoverImage =
    (product.images ?? []).find((image) => image.url !== cover)?.url ?? null

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      /*
       * `group` é do Tailwind (o `group-hover:` do título e da seta) e `rv-card`
       * é do `brand.css`: é ele que acende o convite quando o ponteiro entra no
       * card. Duas classes porque são duas folhas — o utilitário é emitido
       * depois do `brand.css` e venceria qualquer regra de `:hover` escrita lá.
       */
      className="group rv-card block"
    >
      <div data-testid="product-wrapper">
        <div className="relative">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            hoverImage={hoverImage}
            size="full"
            isFeatured={isFeatured}
          />
          {/*
            O chip **saiu de cima da foto**. Sobre a imagem ele disputava
            atenção com a peça e com o botão, e o `inset-4` do recuo da foto
            (o `thumbnail`) tinha de existir só para o chip não encostar nela.
            Agora ele vive na linha de baixo, com o preço — vira informação da
            peça ("Pronta entrega · R$ 249,90") em vez de selo sobre a imagem.
          */}
        </div>
        {/*
         * Título, preço e convite — nesta ordem, e cada um na sua linha.
         *
         * Era uma linha só (título à esquerda, preço à direita), e o preço
         * perdia as duas vezes: era cinza — a cor do texto de apoio — e ficava
         * espremido quando o nome da peça era comprido. Empilhado, o título
         * ganha a largura toda (nome de peça é comprido: "Camisa Feminina em
         * Alfaiataria Seda Pura"), o preço fica sozinho na linha em que o olho o
         * procura, e o botão fecha o card com um alvo do tamanho do polegar.
         */}
        <div className="mt-4 flex flex-col gap-y-2">
          <span
            className="rv-display text-base leading-snug group-hover:text-rv-rose transition-colors duration-200"
            data-testid="product-title"
          >
            {product.title}
          </span>
          {/*
            Preço e estado na **mesma linha**: os dois são sobre a peça, e o olho
            desce uma vez só. O `justify-between` põe o preço à esquerda e o chip
            encostado na direita — é onde a etiqueta tem de estar, e é o que dá
            a leitura de "estado da peça" e não de "botão do card".
          */}
          <div className="flex items-center justify-between gap-3">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
            <ProductStatusChip product={product} />
          </div>
          {/* O traço anda no hover do card (`group-hover`): o movimento é o que
              o ponteiro acrescenta, já que a palavra está sempre aqui — e a
              moldura do botão é o que diz, antes de qualquer hover, que isto é
              onde se clica. */}
          <span className="rv-card-cta rv-eyebrow">
            Comprar
            <span
              aria-hidden="true"
              className="transition-transform duration-200 ease-out group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
