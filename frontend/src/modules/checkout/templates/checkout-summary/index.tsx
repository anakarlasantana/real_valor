import { ShieldCheck } from "@medusajs/icons"

import CartTotals from "@modules/common/components/cart-totals"
import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import InstallmentInfo from "@modules/payment/components/installment-info"

/**
 * O resumo do pedido no checkout — a coluna da direita, que acompanha a rolagem
 * enquanto a cliente preenche endereço, frete e pagamento.
 *
 * Ele dizia "In your Cart" (inglês), abria com o `Heading` do design system e
 * mostrava os totais **antes** das peças. A ordem agora é a de quem confere: o que
 * estou comprando (a lista), quanto está ficando (os totais) e o cupom — que é a
 * última coisa que alguém lembra de aplicar.
 *
 * A caixa é a mesma `.rv-order-summary` da sacola, e agora ela é a mesma por
 * dentro também: o `InstallmentInfo` (que hoje não desenha nada — ele acende quando
 * o parcelamento e o Pix existirem) e o aviso de compra segura no pé, os dois no
 * mesmo lugar em que estão na sacola. Um resumo que muda de conteúdo entre a sacola
 * e o checkout é um resumo em que a cliente não confia.
 */
const CheckoutSummary = ({ cart }: { cart: any }) => {
  return (
    <aside className="rv-order-summary" data-testid="checkout-summary">
      <h2>Resumo do pedido</h2>

      <div className="pt-6">
        <ItemsPreviewTemplate cart={cart} />
      </div>

      <CartTotals totals={cart} />

      <InstallmentInfo
        installments={null}
        pix={null}
        moeda={cart.currency_code}
      />

      <div className="pt-6">
        <DiscountCode cart={cart} />
      </div>

      <p className="rv-secure-note">
        <ShieldCheck aria-hidden="true" focusable="false" />
        Compra segura e protegida
      </p>
    </aside>
  )
}

export default CheckoutSummary
