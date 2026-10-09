"use client"

import { Minus, Plus } from "@medusajs/icons"

import { updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

/**
 * A linha da sacola — foto, informações e preço, na ordem em que se confere uma
 * compra: "é esta peça?" (foto e nome), "nesta cor e tamanho?" (opções), "quantas?"
 * (o passo) e "quanto?" (o preço da linha).
 *
 * **O seletor de quantidade virou um passo** (menos / número / mais), que é o
 * controle da referência: dois botões e o número no meio. O seletor nativo que
 * estava aqui funcionava, mas obrigava a abrir uma lista para tirar uma peça — e o
 * caso comum é exatamente esse, uma a menos. Os dois botões chamam a **mesma**
 * action (`updateLineItem`) que o `<select>` chamava, então nada mudou no
 * carrinho: mudou o gesto. Descer até zero remove a peça, que é o que o Medusa já
 * fazia com quantidade zero.
 *
 * O componente continua atendendo os dois usos: `full` (a página da sacola) e
 * `preview` (a lista curta dentro do resumo do checkout e no menu da sacola).
 * O preview é uma linha de tabela compacta, e por isso o retorno dele é o de
 * sempre — o `type` é decidido aqui, e não em cada chamador.
 */
const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  // TODO: Update this to grab the actual max inventory
  const maxQtyFromInventory = 10
  const maxQuantity = item.variant?.manage_inventory ? 10 : maxQtyFromInventory

  if (type === "preview") {
    return (
      <div className="flex items-start justify-between gap-x-4 py-3" data-testid="product-row">
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className="flex w-16 shrink-0"
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
          />
        </LocalizedClientLink>

        <div className="flex-1 text-left">
          <span className="text-small-semi block text-rv-preto" data-testid="product-title">
            {item.product_title}
          </span>
          <LineItemOptions variant={item.variant} data-testid="product-variant" />
        </div>

        <div className="flex flex-col items-end gap-y-1">
          <span className="flex items-center gap-x-1 text-rv-muted">
            <span>{item.quantity}x</span>
            <LineItemPrice
              item={item}
              style="tight"
              currencyCode={currencyCode}
            />
          </span>
        </div>
      </div>
    )
  }

  return (
    <li className="rv-cart-item" data-testid="product-row">
      <LocalizedClientLink
        href={`/products/${item.product_handle}`}
        className="rv-cart-item-media"
      >
        <Thumbnail
          thumbnail={item.thumbnail}
          images={item.variant?.product?.images}
          size="square"
        />
      </LocalizedClientLink>

      <div className="rv-cart-item-info">
        <h3 data-testid="product-title">{item.product_title}</h3>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />

        <div className="rv-cart-quantity">
          <button
            type="button"
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={updating}
            aria-label="Diminuir quantidade"
            data-testid="product-decrease-button"
          >
            <Minus aria-hidden="true" focusable="false" />
          </button>

          <span aria-live="polite" data-testid="product-quantity">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={updating || item.quantity >= maxQuantity}
            aria-label="Aumentar quantidade"
            data-testid="product-increase-button"
          >
            <Plus aria-hidden="true" focusable="false" />
          </button>

          {/* O giro enquanto o carrinho é atualizado: a linha é de servidor, e
              sem ele o clique pareceria não ter feito nada por um instante. */}
          {updating && <Spinner className="ml-2 animate-spin" aria-hidden="true" />}
        </div>

        <ErrorMessage error={error} data-testid="product-error-message" />
      </div>

      <div className="rv-cart-item-price">
        <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
        <DeleteButton
          id={item.id}
          className="rv-cart-remove"
          data-testid="product-delete-button"
        >
          Remover
        </DeleteButton>
      </div>
    </li>
  )
}

export default Item
