import { getProductPrice } from "@lib/util/get-product-price"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

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

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block"
    >
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          isFeatured={isFeatured}
        />
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
