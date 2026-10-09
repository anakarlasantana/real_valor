import { ShoppingBag } from "@medusajs/icons"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * A sacola vazia — o estado que a referência desenha como o bloco de vazio da
 * loja: ícone, título, uma frase e o caminho de volta para a vitrine.
 *
 * Era o texto do starter em inglês ("You don't have anything in your cart. Let's
 * change that...") com um link sublinhado no meio do nada, alinhado à esquerda. A
 * sacola vazia é o vazio mais provável da loja (quem clica na sacola antes de
 * escolher algo chega aqui), e ele agora usa o mesmo componente do vazio da busca
 * (`EmptyState`): uma forma só para "não tem nada aqui" em toda a loja.
 */
const EmptyCartMessage = () => {
  return (
    <EmptyState
      icon={<ShoppingBag aria-hidden="true" focusable="false" />}
      title="Sua sacola está vazia"
      text="Descubra peças criadas para acompanhar a sua história."
      data-testid="empty-cart-message"
    >
      <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
        Explorar a coleção
      </LocalizedClientLink>
    </EmptyState>
  )
}

export default EmptyCartMessage
