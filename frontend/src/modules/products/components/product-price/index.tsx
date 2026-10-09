import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import InstallmentInfo from "@modules/payment/components/installment-info"

/**
 * O preço na página da peça, no bloco entre filetes do redesenho.
 *
 * O que a cliente lê, na ordem: o número de agora (grande, em display), o "De" do
 * preço cheio e o desconto em porcentagem. O rótulo "A partir de" aparece só
 * quando o preço é o **da variante mais barata** — e não o de uma variante
 * escolhida —, porque é aí que o número precisa dizer de onde ele vem.
 *
 * Os dois rótulos estavam em inglês ("From", "Original:") numa loja pt-BR — o
 * mesmo defeito do RV-003, e no lugar mais visível da página. A palavra do
 * "De/Por" que a cliente reconhece é "De".
 *
 * **As parcelas e o Pix estão montados, e ainda não acendem.** O bloco existe
 * (`InstallmentInfo`, no fim do `<small>`) com a moeda do próprio preço, mas os
 * dois números são de fora do Medusa: o parcelamento é do meio de pagamento e o
 * valor do Pix dependeria de uma regra de desconto que a loja ainda não cadastrou.
 * Enquanto eles não chegarem, a linha não é desenhada — inventar aqui seria a loja
 * prometendo condição de pagamento que ela pode não ter.
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
    return (
      <div className="rv-price-block">
        <span className="block h-7 w-32 animate-pulse bg-rv-border" />
      </div>
    )
  }

  const onSale = selectedPrice.price_type === "sale"

  return (
    <div className="rv-price-block">
      <strong
        data-testid="product-price"
        data-value={selectedPrice.calculated_price_number}
        className={clx({ "rv-price-sale": onSale })}
      >
        {selectedPrice.calculated_price}
      </strong>

      <small>
        {!variant && <span>A partir de</span>}

        {onSale && (
          <>
            <span>
              De{" "}
              <span
                className="rv-price-was"
                data-testid="original-product-price"
                data-value={selectedPrice.original_price_number}
              >
                {selectedPrice.original_price}
              </span>
            </span>
            <span className="rv-price-sale">
              -{selectedPrice.percentage_diff}%
            </span>
          </>
        )}

        {/*
          As parcelas e o Pix. A moeda é a do preço que está na tela (é o único
          dado dos dois que já existe aqui); o parcelamento e o valor do Pix
          chegam com o adapter do provedor, e sem eles o bloco não é desenhado —
          ver o comentário no topo deste arquivo.
        */}
        <InstallmentInfo
          installments={null}
          pix={null}
          moeda={selectedPrice.currency_code}
        />
      </small>
    </div>
  )
}
