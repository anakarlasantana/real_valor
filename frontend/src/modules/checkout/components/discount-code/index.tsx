"use client"

import React from "react"

import { applyPromotions } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"

import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

/**
 * O cupom, no pé do resumo do pedido.
 *
 * Ele era a última coisa em inglês do checkout — "Add Promotion Code(s)",
 * "Apply", "Promotion(s) applied:", "Remove discount code from order" —, com o
 * `Input`/`Badge`/`Heading` do design system e uma árvore de `div` para posicionar
 * duas palavras. Agora é o `.rv-coupon` do `brand.css`: o convite é um botão de
 * texto, o campo entra na linha do "Aplicar", e o cupom aplicado é uma linha com o
 * código à esquerda e o "Remover" à direita.
 *
 * **O comportamento é o mesmo, linha por linha**: o `applyPromotions`, o input
 * achado por `getElementById("promotion-input")` (é ele que o formulário limpa
 * depois de aplicar), os mesmos `data-testid` e a mesma regra de não deixar remover
 * um cupom automático — o automático não foi a cliente que colocou, e tirá-lo daria
 * a ela a impressão de ter mexido numa regra da loja.
 *
 * A bolinha verde do código promocional saiu: o verde aqui é de "boa notícia de
 * dinheiro" (o frete grátis, o Pix), e não de "esta etiqueta é automática". O
 * código continua legível em negrito, e o valor entre parênteses continua ao lado.
 */
const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  const { promotions = [] } = cart
  const removePromotionCode = async (code: string) => {
    const validPromotions = promotions.filter(
      (promotion) => promotion.code !== code
    )

    await applyPromotions(
      validPromotions.filter((p) => p.code !== undefined).map((p) => p.code!)
    )
  }

  const addPromotionCode = async (formData: FormData) => {
    setErrorMessage("")

    const code = formData.get("code")
    if (!code) {
      return
    }
    const input = document.getElementById("promotion-input") as HTMLInputElement
    const codes = promotions
      .filter((p) => p.code !== undefined)
      .map((p) => p.code!)
    codes.push(code.toString())

    try {
      await applyPromotions(codes)
    } catch (e: any) {
      setErrorMessage(e.message)
    }

    if (input) {
      input.value = ""
    }
  }

  return (
    <div className="rv-coupon">
      <form action={(a) => addPromotionCode(a)}>
        <button
          type="button"
          className="rv-btn rv-btn-text"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="add-discount-button"
        >
          {isOpen ? "Fechar o cupom" : "Adicionar cupom"}
        </button>

        {isOpen && (
          <>
            <div className="rv-coupon-row">
              <label className="rv-form-field">
                Cupom
                <input
                  id="promotion-input"
                  name="code"
                  type="text"
                  autoFocus={false}
                  data-testid="discount-input"
                />
              </label>
              <SubmitButton
                variant="secondary"
                data-testid="discount-apply-button"
              >
                Aplicar
              </SubmitButton>
            </div>

            <ErrorMessage
              error={errorMessage}
              data-testid="discount-error-message"
            />
          </>
        )}
      </form>

      {promotions.length > 0 && (
        <div className="rv-coupon-list">
          <span className="rv-fieldset-label">Cupom aplicado</span>

          {promotions.map((promotion) => {
            const metodo = promotion.application_method

            return (
              <div
                key={promotion.id}
                className="rv-coupon-item"
                data-testid="discount-row"
              >
                <span data-testid="discount-code">
                  <b>{promotion.code}</b>{" "}
                  {metodo?.value !== undefined &&
                    metodo.currency_code !== undefined && (
                      <>
                        (
                        {metodo.type === "percentage"
                          ? `${metodo.value}%`
                          : convertToLocale({
                              amount: +metodo.value,
                              currency_code: metodo.currency_code,
                            })}
                        )
                      </>
                    )}
                </span>

                {!promotion.is_automatic && (
                  <button
                    type="button"
                    className="rv-btn rv-btn-text"
                    onClick={() => {
                      if (!promotion.code) {
                        return
                      }

                      removePromotionCode(promotion.code)
                    }}
                    data-testid="remove-discount-button"
                  >
                    <Trash size={14} />
                    <span className="sr-only">Remover o cupom do pedido</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DiscountCode
