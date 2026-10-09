"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { setShippingMethod } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import ErrorMessage from "@modules/checkout/components/error-message"

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  /**
   * `StoreCartShippingOptionWithServiceZone`, e nao o `StoreCartShippingOption`
   * base: e' a varianie que traz `service_zone` — de onde sai o tipo "pickup"
   * e o endereco da loja (`listCartShippingMethods` ja devolve esse formato).
   * Tipar pela base fazia o `tsc` reprovar leitura de dado que existe.
   */
  availableShippingMethods: HttpTypes.StoreCartShippingOptionWithServiceZone[] | null
}

/**
 * O que `formatAddress` sabe imprimir.
 *
 * O endereco da opcao de frete (`StoreFulfillmentAddress`) e o endereco do
 * carrinho (`StoreCartAddress`) sao dois tipos distintos do Medusa com o mesmo
 * formato, e a funcao ja serve aos dois — como a ausencia deles, que e' o caso
 * comum quando a loja nao tem endereco de retirada cadastrado.
 */
type PrintableAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
}

function formatAddress(address: PrintableAddress | null | undefined) {
  if (!address) {
    return ""
  }

  let ret = ""

  if (address.address_1) {
    ret += ` ${address.address_1}`
  }

  if (address.address_2) {
    ret += `, ${address.address_2}`
  }

  if (address.postal_code) {
    ret += `, ${address.postal_code} ${address.city}`
  }

  if (address.country_code) {
    ret += `, ${address.country_code.toUpperCase()}`
  }

  return ret
}

/**
 * O passo 2 do checkout — "Entrega".
 *
 * Ele era o bloco "Delivery" do starter (com "Shipping method" e "How would you
 * like you order delivered" dentro) e virou o segundo `<fieldset>` numerado. A
 * lista de métodos deixa de ser uma fileira de caixas do design system e passa a
 * ser o cartão da referência: o ponto de escolha à esquerda, o nome no meio e o
 * valor na ponta direita — e o cartão inteiro é o alvo do clique.
 *
 * **O que não mudou:** o `RadioGroup` do headlessui (o teclado e o `role="radio"`
 * são dele), o `setShippingMethod`, o cálculo de preço por CEP
 * (`calculatePriceForShippingOption`) e todos os `data-testid`.
 *
 * Duas escolhas de conteúdo, e as duas são para não prometer o que não se sabe:
 *
 *  - **não há "3 a 5 dias úteis" no cartão.** A referência escreve um prazo fixo
 *    ali; a loja não tem esse dado por opção de frete — o que ela tem é o preço
 *    calculado para o CEP. Escrever um prazo seria a mesma promessa por escrito que
 *    a página da peça já recusou uma vez (ver o comentário do `product-actions`).
 *  - **"Grátis" em vez de "R$ 0,00"**: o zero do frete é boa notícia, e é a mesma
 *    palavra que o resumo usa para o frete grátis.
 */
const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const _shippingMethods = availableShippingMethods?.filter(
    (sm) => sm.service_zone?.fulfillment_set?.type !== "pickup"
  )

  const _pickupMethods = availableShippingMethods?.filter(
    (sm) => sm.service_zone?.fulfillment_set?.type === "pickup"
  )

  const hasPickupOptions = !!_pickupMethods?.length

  useEffect(() => {
    setIsLoadingPrices(true)

    if (_shippingMethods?.length) {
      const promises = _shippingMethods
        .filter((sm) => sm.price_type === "calculated")
        .map((sm) => calculatePriceForShippingOption(sm.id, cart.id))

      if (promises.length) {
        Promise.allSettled(promises).then((res) => {
          const pricesMap: Record<string, number> = {}
          res
            .filter((r) => r.status === "fulfilled")
            .forEach((p) => (pricesMap[p.value?.id || ""] = p.value?.amount!))

          setCalculatedPricesMap(pricesMap)
          setIsLoadingPrices(false)
        })
      }
    }

    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [availableShippingMethods])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup"
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
    }

    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
      .catch((err) => {
        setShippingMethodId(currentId)

        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  const metodoEscolhido = cart.shipping_methods?.at(-1)

  const dinheiro = (valor: number) =>
    convertToLocale({ amount: valor, currency_code: cart?.currency_code })

  return (
    <fieldset className="rv-fieldset">
      <legend>
        <span>2</span>
        Entrega
        {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
          <CheckCircleSolid aria-hidden="true" focusable="false" />
        )}
      </legend>

      {isOpen ? (
        <>
          <p className="rv-fieldset-note">
            <strong>Forma de entrega</strong>
            Como você quer receber o seu pedido?
          </p>

          {hasPickupOptions && (
            <RadioGroup
              value={showPickupOptions}
              onChange={(value) => {
                const id = _pickupMethods.find(
                  (option) => !option.insufficient_inventory
                )?.id

                if (id) {
                  handleSetShippingMethod(id, "pickup")
                }
              }}
            >
              <Radio
                value={PICKUP_OPTION_ON}
                data-testid="delivery-option-radio"
                className={clx("rv-shipping-option", {
                  "rv-option-selected": showPickupOptions === PICKUP_OPTION_ON,
                })}
              >
                <span
                  className="rv-choice"
                  aria-hidden="true"
                  data-testid="radio-button"
                />
                <span className="rv-option-body">
                  <strong>Retirar na loja</strong>
                  {_pickupMethods[0]?.service_zone?.fulfillment_set?.location
                    ?.address && (
                    <small>
                      {formatAddress(
                        _pickupMethods[0].service_zone.fulfillment_set.location
                          .address
                      )}
                    </small>
                  )}
                </span>
                <span className="rv-option-price">-</span>
              </Radio>
            </RadioGroup>
          )}

          <div data-testid="delivery-options-container">
            <RadioGroup
              value={shippingMethodId}
              onChange={(v) => {
                if (v) {
                  return handleSetShippingMethod(v, "shipping")
                }
              }}
            >
              {_shippingMethods?.map((option) => {
                const isDisabled =
                  option.price_type === "calculated" &&
                  !isLoadingPrices &&
                  typeof calculatedPricesMap[option.id] !== "number"

                const preco =
                  option.price_type === "flat"
                    ? option.amount
                    : calculatedPricesMap[option.id]

                return (
                  <Radio
                    key={option.id}
                    value={option.id}
                    disabled={isDisabled}
                    data-testid="delivery-option-radio"
                    className={clx("rv-shipping-option", {
                      "rv-option-selected": option.id === shippingMethodId,
                      "rv-option-disabled": isDisabled,
                    })}
                  >
                    <span
                      className="rv-choice"
                      aria-hidden="true"
                      data-testid="radio-button"
                    />
                    <span className="rv-option-body">
                      <strong>{option.name}</strong>
                    </span>
                    <span
                      className={clx("rv-option-price", {
                        "rv-option-price-free": preco === 0,
                      })}
                    >
                      {typeof preco === "number"
                        ? preco === 0
                          ? "Grátis"
                          : dinheiro(preco)
                        : isLoadingPrices
                          ? "…"
                          : "-"}
                    </span>
                  </Radio>
                )
              })}
            </RadioGroup>
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <div data-testid="delivery-options-container">
              <p className="rv-fieldset-note">
                <strong>Loja</strong>
                Escolha a loja mais perto de você
              </p>
              <RadioGroup
                value={shippingMethodId}
                onChange={(v) => {
                  if (v) {
                    return handleSetShippingMethod(v, "pickup")
                  }
                }}
              >
                {_pickupMethods?.map((option) => (
                  <Radio
                    key={option.id}
                    value={option.id}
                    disabled={option.insufficient_inventory}
                    data-testid="delivery-option-radio"
                    className={clx("rv-shipping-option", {
                      "rv-option-selected": option.id === shippingMethodId,
                      "rv-option-disabled": !!option.insufficient_inventory,
                    })}
                  >
                    <span
                      className="rv-choice"
                      aria-hidden="true"
                      data-testid="radio-button"
                    />
                    <span className="rv-option-body">
                      <strong>{option.name}</strong>
                      <small>
                        {formatAddress(
                          option.service_zone?.fulfillment_set?.location?.address
                        )}
                      </small>
                    </span>
                    <span className="rv-option-price">
                      {convertToLocale({
                        amount: option.amount!,
                        currency_code: cart?.currency_code,
                      })}
                    </span>
                  </Radio>
                ))}
              </RadioGroup>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="delivery-option-error-message"
          />
          <button
            type="button"
            className="rv-btn rv-btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !cart.shipping_methods?.[0]}
            data-testid="submit-delivery-option-button"
          >
            Continuar para o pagamento
          </button>
        </>
      ) : (
        <>
          {metodoEscolhido ? (
            <>
              <div className="rv-fieldset-action">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rv-form-action"
                  data-testid="edit-delivery-button"
                >
                  Editar
                </button>
              </div>
              <div className="rv-fieldset-summary">
                <div>
                  <span className="rv-fieldset-label">Forma de entrega</span>
                  <p>
                    {metodoEscolhido.name} ·{" "}
                    {metodoEscolhido.amount === 0
                      ? "Grátis"
                      : dinheiro(metodoEscolhido.amount!)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="rv-fieldset-note">
              Informe o endereço acima para ver as formas de entrega.
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}

export default Shipping
