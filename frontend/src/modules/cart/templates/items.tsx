import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

/**
 * A lista de itens da sacola.
 *
 * Era uma `<Table>` do design system, com título "Cart", cabeçalho de colunas
 * ("Item", "Quantity", "Price", "Total") e uma linha por produto. Numa loja de
 * roupa isso é o desenho de um extrato: uma peça é foto, nome, cor e tamanho, e o
 * que a cliente precisa ver primeiro é a foto dela — não um cabeçalho de tabela
 * em inglês.
 *
 * Agora é uma lista (`<ul>`), com cada peça em `Item type="full"` (a linha de três
 * colunas do redesenho). O cabeçalho de colunas saiu e não faz falta: as três
 * colunas falam por si (foto, informação, preço), e a única leitura que um
 * cabeçalho acrescentava era a palavra "Quantity".
 */
const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items

  return (
    <ul className="rv-cart-items" data-testid="cart-items">
      {items
        ? items
            .sort((a, b) => {
              return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
            })
            .map((item) => {
              return (
                <Item
                  key={item.id}
                  item={item}
                  currencyCode={cart?.currency_code}
                />
              )
            })
        : repeat(5).map((i) => (
            <li key={i}>
              <SkeletonLineItem />
            </li>
          ))}
    </ul>
  )
}

export default ItemsTemplate
