import { Dialog, Transition } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import React, { Fragment, useMemo } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import ChevronDown from "@modules/common/icons/chevron-down"
import X from "@modules/common/icons/x"

import { getProductPrice } from "@lib/util/get-product-price"
import { coresDoProduto } from "@lib/util/product-enrichment"
import OptionSelect from "./option-select"
import { HttpTypes } from "@medusajs/types"
import { isSimpleProduct } from "@lib/util/product"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (title: string, value: string) => void
  inStock?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
}

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
}) => {
  const { state, open, close } = useToggleState()

  const price = getProductPrice({
    product: product,
    variantId: variant?.id,
  })

  const selectedPrice = useMemo(() => {
    if (!price) {
      return null
    }
    const { variantPrice, cheapestPrice } = price

    return variantPrice || cheapestPrice || null
  }, [price])

  const isSimple = isSimpleProduct(product)

  // As cores da peça, para o seletor do modal desenhar amostras na opção de cor —
  // a mesma função do card e a mesma conta do seletor do desktop
  // (`product-actions/index.tsx`). O modal não pode mostrar outra coisa.
  const cores = coresDoProduto(product)

  return (
    <>
      <div
        className={clx("lg:hidden inset-x-0 bottom-0 fixed z-50", {
          "pointer-events-none": !show,
        })}
      >
        <Transition
          as={Fragment}
          show={show}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-y-3 border-t border-rv-border bg-rv-surface p-4 text-large-regular"
            data-testid="mobile-actions"
          >
            <div className="flex items-center gap-x-2">
              <span data-testid="mobile-title">{product.title}</span>
              <span aria-hidden="true">—</span>
              {selectedPrice ? (
                <div className="flex items-end gap-x-2 text-rv-preto">
                  {selectedPrice.price_type === "sale" && (
                    <span className="rv-price-was">
                      {selectedPrice.original_price}
                    </span>
                  )}
                  <span
                    className={clx("rv-price-value", {
                      "rv-price-sale": selectedPrice.price_type === "sale",
                    })}
                  >
                    {selectedPrice.calculated_price}
                  </span>
                </div>
              ) : null}
            </div>
            <div
              className={clx("grid w-full gap-x-4", {
                "grid-cols-2": !isSimple,
                "grid-cols-1": isSimple,
              })}
            >
              {!isSimple && (
                <button
                  type="button"
                  onClick={open}
                  className="rv-btn rv-btn-secondary w-full"
                  data-testid="mobile-actions-button"
                >
                  <span className="flex w-full items-center justify-between">
                    <span>
                      {variant
                        ? Object.values(options).join(" / ")
                        : "Escolher opções"}
                    </span>
                    <ChevronDown aria-hidden="true" focusable="false" />
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock || !variant || isAdding}
                className="rv-btn rv-btn-primary w-full"
                data-testid="mobile-cart-button"
              >
                {isAdding
                  ? "Adicionando…"
                  : !variant
                    ? "Selecione o tamanho"
                    : !inStock
                      ? "Esgotado"
                      : "Comprar"}
              </button>
            </div>
          </div>
        </Transition>
      </div>
      <Transition appear show={state} as={Fragment}>
        <Dialog as="div" className="relative z-[75]" onClose={close}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-700 bg-opacity-75 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed bottom-0 inset-x-0">
            <div className="flex min-h-full h-full items-center justify-center text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Panel
                  className="w-full h-full transform overflow-hidden text-left flex flex-col gap-y-3"
                  data-testid="mobile-actions-modal"
                >
                  <div className="w-full flex justify-end pr-6">
                    <button
                      onClick={close}
                      className="rv-icon-btn bg-rv-surface"
                      data-testid="close-modal-button"
                    >
                      <X />
                    </button>
                  </div>
                  <div className="bg-rv-surface px-6 py-12">
                    {(product.variants?.length ?? 0) > 1 && (
                      <div className="flex flex-col gap-y-6">
                        {(product.options || []).map((option) => {
                          return (
                            <div key={option.id}>
                              <OptionSelect
                                option={option}
                                current={options[option.id]}
                                updateOption={updateOptions}
                                title={option.title ?? ""}
                                cores={cores}
                                disabled={optionsDisabled}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default MobileActions
