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
      className="group block"
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
          {/* O respiro de 1rem é o mesmo `p-4` da moldura da foto, então o
              chip alinha com a imagem e não com a sombra dela. */}
          <ProductStatusChip
            product={product}
            className="absolute left-4 top-4"
          />
        </div>
        <div className="flex flex-col gap-y-1 mt-4">
          <div className="flex txt-compact-medium justify-between gap-x-4">
            <span
              className="rv-display text-base leading-snug group-hover:text-rv-rose transition-colors duration-200"
              data-testid="product-title"
            >
              {product.title}
            </span>
            <div className="flex items-center gap-x-2 shrink-0">
              {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
            </div>
          </div>
          <span className="rv-eyebrow text-rv-rose opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Comprar
          </span>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
