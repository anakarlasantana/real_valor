import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

/**
 * O preço na página da peça: "A partir de" e o "De" do preço cheio, em pt-BR.
 * -------------------------------------------------------------------------
 * Os dois rótulos estavam em inglês ("From", "Original:") numa loja pt-BR — o
 * mesmo defeito do RV-003, e no lugar mais visível da página. A palavra do
 * "De/Por" que a cliente reconhece é "De", e é ela que fica ao lado do preço
 * riscado; "A partir de" só aparece quando o preço é o da variante mais barata,
 * e não de uma variante escolhida.
 *
 * O `-x%` continua aqui (na página), e o card passou a mostrá-lo também: é o
 * mesmo `percentage_diff`, calculado uma vez em `get-product-price.ts`.
 */
export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-gray-100 animate-pulse" />
  }

  return (
    <div className="flex flex-col text-ui-fg-base">
      <span
        className={clx("text-xl-semi", {
          "text-ui-fg-interactive": selectedPrice.price_type === "sale",
        })}
      >
        {!variant && "A partir de "}
        <span
          data-testid="product-price"
          data-value={selectedPrice.calculated_price_number}
        >
          {selectedPrice.calculated_price}
        </span>
      </span>
      {selectedPrice.price_type === "sale" && (
        <>
          <p>
            <span className="text-ui-fg-subtle">De </span>
            <span
              className="line-through"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
          </p>
          <span className="text-ui-fg-interactive">
            -{selectedPrice.percentage_diff}%
          </span>
        </>
      )}
    </div>
  )
}
