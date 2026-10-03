"use client"

import { RadioGroup } from "@headlessui/react"
import { resolvePayment } from "@lib/payments/registry"
import { initiatePaymentSession } from "@lib/data/cart"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Button, Container, Heading, Text, clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

/**
 * Este meio precisa de formulário na NOSSA página?
 *
 * A pergunta que o checkout fazia antes era `isStripeLike(id)`, e ela é a
 * razão de o fluxo estar amarrado a um provedor. Agora é `fulfillment`:
 * `inline` desenha aqui, `redirect` vai para o Checkout Pro do provedor,
 * `external` é só finalizar o pedido. Trocar Checkout Pro por Checkout API é
 * mudar um valor no adapter — esta linha não muda.
 */
const needsInlineInput = (providerId?: string | null) =>
  resolvePayment(providerId).fulfillment === "inline"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    // O meio `inline` precisa de uma sessão ativa antes de o cartão existir
    // (é ela que traz o `client_secret`). Os demais não: o Checkout Pro cria a
    // preference no redirecionamento, e o manual não cria nada.
    if (resolvePayment(method).fulfillment === "inline") {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const paymentReady =
    (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // **Este é o ponto de desacoplamento do RV-002.** Antes era
      // `isStripeLike(...) && !activeSession` — o fluxo perguntava ao PROVEDOR
      // "este meio precisa de cartão na minha página?". Agora pergunta ao
      // REGISTRO "como este meio se completa?": `redirect` vai para o Checkout
      // Pro do provedor, `inline` desenha aqui, `external` é só finalizar.
      const inlineInput = needsInlineInput(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!inlineInput) {
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          Payment
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              Editar
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map((paymentMethod) => {
                  // O meio `inline` traz a própria UI; os outros, só a linha de
                  // seleção. Quem decide é o ADAPTER — o checkout não compara
                  // id, não conhece provedor e não importa adapter.
                  const adapter = resolvePayment(paymentMethod.id)
                  const { InlineUI } = adapter
                  const selected = selectedPaymentMethod === paymentMethod.id

                  return (
                    <div key={paymentMethod.id}>
                      {adapter.fulfillment === "inline" && InlineUI ? (
                        <PaymentContainer
                          paymentProviderId={paymentMethod.id}
                          selectedPaymentOptionId={selectedPaymentMethod}
                        >
                          <InlineUI
                            selected={selected}
                            onStatus={(status) => {
                              setCardComplete(status.complete ?? false)
                              if (status.brand) {
                                setCardBrand(status.brand)
                              }
                              setError(status.error ?? null)
                            }}
                          />
                        </PaymentContainer>
                      ) : (
                        <PaymentContainer
                          paymentProviderId={paymentMethod.id}
                          selectedPaymentOptionId={selectedPaymentMethod}
                        />
                      )}
                    </div>
                  )
                })}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Forma de pagamento
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Cartão-presente
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (needsInlineInput(selectedPaymentMethod) &&
                !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {needsInlineInput(selectedPaymentMethod)
              ? " Informar os dados do cartão"
              : "Continuar para a revisão"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Forma de pagamento
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {resolvePayment(activeSession?.provider_id).label}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Detalhes do pagamento
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {resolvePayment(selectedPaymentMethod).icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>
                    {needsInlineInput(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : "O próximo passo aparece aqui"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Forma de pagamento
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Cartão-presente
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
