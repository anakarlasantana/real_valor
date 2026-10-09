"use client"

import { ShieldCheck } from "@medusajs/icons"

import CartTotals from "@modules/common/components/cart-totals"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import DiscountCode from "@modules/checkout/components/discount-code"
import InstallmentInfo from "@modules/payment/components/installment-info"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

/**
 * O resumo do pedido, na coluna da direita.
 *
 * Ele seguia o resumo do starter — título "Summary", `Heading` do design system e
 * um botão azul — e virou a caixa da referência: título em português, as linhas de
 * valor do `CartTotals`, o convite para o checkout e o aviso de compra segura.
 *
 * **As parcelas estão montadas, e ainda não acendem.** A referência escreve "6x de
 * R$ ... sem juros" e "Desconto Pix (5%)" nesta caixa, e o bloco
 * (`InstallmentInfo`) está no lugar certo — abaixo dos totais, onde a condição de
 * pagamento é lida. O que falta não é desenho, é dado: o parcelamento é do meio de
 * pagamento (`describe(amount)` do adapter, no checkout) e o **desconto do Pix é
 * uma regra que a loja ainda não cadastrou** — o checkout anuncia 5% e o adapter
 * do Mercado Pago não aplica desconto nenhum hoje. Escrever o número aqui seria a
 * cliente chegar ao pagamento e pagar outro valor. Por isso a linha do desconto
 * **não** existe nesta caixa, e as parcelas só nascem com o número do provedor.
 *
 * O botão **é um link** para o checkout (é navegação, não ação de tela) e usa as
 * classes do `brand.css`: o `Button` do design system traria o azul da Medusa, e
 * classe de utilitário ganha do `brand.css` — a conta está no topo daquele
 * arquivo.
 */
const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <aside className="rv-order-summary" data-testid="cart-summary">
      <h2>Resumo do pedido</h2>

      <DiscountCode cart={cart} />

      <CartTotals totals={cart} />

      {/*
        O parcelamento e o Pix, abaixo dos totais. A moeda é a do carrinho; os dois
        números chegam com o adapter do provedor — ver o comentário acima.
      */}
      <InstallmentInfo
        installments={null}
        pix={null}
        moeda={cart.currency_code}
      />

      <LocalizedClientLink
        href={"/checkout?step=" + step}
        className="rv-btn rv-btn-primary mt-6 w-full"
        data-testid="checkout-button"
      >
        Ir para o pagamento
      </LocalizedClientLink>

      <p className="rv-secure-note">
        <ShieldCheck aria-hidden="true" focusable="false" />
        Compra segura e protegida
      </p>
    </aside>
  )
}

export default Summary
