"use client"

import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart: HttpTypes.StoreCart
}

/**
 * A lista curta da sacola — a que aparece dentro do resumo do checkout.
 *
 * Era uma `<Table>` do design system, e deixou de ser tabela pela mesma razão da
 * lista da página da sacola: cada peça é uma linha de foto, nome e preço, e a
 * tabela só acrescentava o cabeçalho de colunas. Agora é uma lista, com o `Item`
 * no modo `preview` (compacto) — o mesmo componente, o mesmo dado, o mesmo link
 * para a peça.
 *
 * O teto de 4 itens antes da rolagem continua: o resumo é uma coluna de apoio, e
 * uma lista longa empurraria os totais para fora da tela.
 */
const ItemsPreviewTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart.items
  const hasOverflow = items && items.length > 4

  return (
    <div
      className={clx("divide-y divide-rv-border", {
        "max-h-[420px] overflow-y-scroll overflow-x-hidden no-scrollbar pl-px":
          hasOverflow,
      })}
      data-testid="items-table"
    >
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
                  type="preview"
                  currencyCode={cart.currency_code}
                />
              )
            })
        : repeat(5).map((i) => {
            return <SkeletonLineItem key={i} />
          })}
    </div>
  )
}

export default ItemsPreviewTemplate
