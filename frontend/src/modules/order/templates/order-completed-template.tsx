import { ShieldCheck } from "@medusajs/icons"
import { cookies as nextCookies } from "next/headers"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

/**
 * A página de pedido confirmado.
 *
 * Ela abria em "Obrigada! Seu pedido foi feito com sucesso." — duas linhas de
 * `Heading` do design system, sem marca, sem hierarquia — e seguia com "Summary"
 * (inglês) antes da lista do que foi comprado. Agora abre como a referência
 * desenha o fecho da compra: a marca verde de "deu certo", o agradecimento no
 * corpo de capa e, embaixo, o pedido de verdade — número, itens, totais, entrega
 * e pagamento.
 *
 * **O que a referência desenha aqui e não entrou — e não é pendência de dado:**
 * o cartão de "Próximo passo" ("Estamos preparando sua peça com todo cuidado." +
 * "Previsão de entrega: 3 a 5 dias úteis") e o botão "Acompanhar meu pedido". O
 * primeiro promete um prazo genérico quando o pedido **já tem** o prazo do frete
 * escolhido — e é a `ShippingDetails` logo abaixo que o mostra, com o número real.
 * O segundo levaria a `/account`, e o pedido está nesta página: um botão que leva
 * para outro lugar é o que se põe quando não há mais nada a mostrar, e aqui há. Os
 * dois ficam de fora por decisão de desenho, e não à espera de dado — ao contrário
 * dos blocos de avaliação, frete e parcelas da página da peça.
 */
export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  return (
    <main data-testid="order-complete-container">
      <div className="rv-confirmation">
        <div className="rv-confirmation-mark">
          <ShieldCheck aria-hidden="true" focusable="false" />
        </div>

        <span className="rv-eyebrow text-rv-rose-strong">
          Pedido confirmado
        </span>

        <h1>
          Obrigada por escolher <em>o seu valor.</em>
        </h1>

        <p>
          Seu pedido foi feito com sucesso. Enviamos todos os detalhes para o seu
          e-mail.
        </p>

        {isOnboarding && <OnboardingCta orderId={order.id} />}
      </div>

      <div className="rv-container">
        <OrderDetails order={order} />

        <h2 className="rv-page-heading mt-16">Seu pedido</h2>

        <Items order={order} />

        <CartTotals totals={order} />

        <ShippingDetails order={order} />

        <PaymentDetails order={order} />

        <Help />
      </div>
    </main>
  )
}
