import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"

/**
 * O formulário do checkout: a abertura, os três passos numerados e o fecho.
 *
 * A abertura é o par da casa — o `rv-eyebrow` e o corpo de capa da serifa —, e é
 * ela que dá à tela o que ela não tinha: um título. Antes, a coluna da esquerda
 * começava direto no bloco "Shipping Address" do starter, sem dizer onde a cliente
 * estava nem que faltavam três passos.
 *
 * Os passos são componentes e não marcação daqui: cada um é dono do próprio
 * `?step=` (é ele que sabe se está aberto, qual o resumo do que já foi respondido e
 * qual a próxima etapa), e o `<fieldset>` numerado é desenhado dentro dele. Este
 * arquivo **não** decide estado de passo nenhum — foi assim no starter, e é assim
 * aqui: o que ele faz é a ordem, que é a da referência (dados → entrega →
 * pagamento) e a do Medusa ao mesmo tempo.
 */
export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <section className="rv-checkout-form">
      <div className="rv-checkout-title">
        <span className="rv-eyebrow text-rv-rose-strong">
          Finalize sua compra
        </span>
        <h1>Checkout</h1>
      </div>

      <Addresses cart={cart} customer={customer} />

      <Shipping cart={cart} availableShippingMethods={shippingMethods} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} />

      <Review cart={cart} />
    </section>
  )
}
