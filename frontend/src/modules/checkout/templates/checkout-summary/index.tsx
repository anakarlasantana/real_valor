import CartTotals from "@modules/common/components/cart-totals"
import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"

/**
 * O resumo do pedido no checkout — a coluna da direita, que acompanha a rolagem
 * enquanto a cliente preenche endereço, frete e pagamento.
 *
 * Ele dizia "In your Cart" (inglês), abria com o `Heading` do design system e
 * mostrava os totais **antes** das peças. A ordem agora é a de quem confere: o que
 * estou comprando (a lista), quanto está ficando (os totais) e o cupom — que é a
 * última coisa que alguém lembra de aplicar.
 *
 * A caixa é a mesma `.rv-order-summary` da sacola: é o mesmo objeto na mesma
 * compra, e ele não pode mudar de forma entre a sacola e o checkout.
 */
const CheckoutSummary = ({ cart }: { cart: any }) => {
  return (
    <aside
      className="rv-order-summary"
      data-testid="checkout-summary"
    >
      <h2>Resumo do pedido</h2>

      <div className="pt-6">
        <ItemsPreviewTemplate cart={cart} />
      </div>

      <CartTotals totals={cart} />

      <div className="pt-6">
        <DiscountCode cart={cart} />
      </div>
    </aside>
  )
}

export default CheckoutSummary
