"use client"

import { useSearchParams } from "next/navigation"

import PaymentButton from "../payment-button"

/**
 * O fecho do checkout — o aceite e o botão de finalizar.
 *
 * Ele não é um quarto passo numerado, e essa é a decisão de desenho: na referência
 * o "Finalizar pedido" é o **último elemento do formulário**, de largura inteira,
 * depois dos três campos. Aqui ele é o mesmo — a nota de aceite e o botão, abaixo
 * do passo 3 —, e continua aparecendo só quando o passo de revisão está aberto e os
 * passos anteriores estão completos (é o `?step=review` que a etapa de pagamento
 * empurra).
 *
 * O texto do aceite saiu do inglês ("By clicking the Place Order button… Medusa
 * Store's Privacy Policy") e virou português — e ele deixou de citar a Medusa, que
 * não é a loja com quem a cliente está contratando. Ele continua **antes** do
 * botão, e não depois: é o último lugar em que ele é lido antes do clique.
 */
const Review = ({ cart }: { cart: any }) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard)

  if (!(isOpen && previousStepsCompleted)) {
    return null
  }

  return (
    <>
      <p className="rv-checkout-terms">
        Ao clicar em Finalizar pedido, você confirma que leu e aceita os Termos de
        Uso, os Termos de Venda e a Política de Trocas e Devoluções, e declara ter
        lido a Política de Privacidade da Real Valor.
      </p>
      <PaymentButton cart={cart} data-testid="submit-order-button" />
    </>
  )
}

export default Review
