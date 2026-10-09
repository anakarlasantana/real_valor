"use client"

import { RadioGroup } from "@headlessui/react"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useState } from "react"

import { initiatePaymentSession } from "@lib/data/cart"
import { resolvePayment } from "@lib/payments/registry"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"

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

/**
 * O passo 3 do checkout — "Pagamento".
 *
 * Ele era o bloco "Payment" do starter: `Heading` do design system, um link
 * "Editar" solto e as opções numa caixa com o azul da Medusa. Agora é o terceiro
 * `<fieldset>` numerado, com as opções no cartão `.rv-payment-option` — o mesmo do
 * frete, com o formulário do cartão (quando o meio precisa dele) logo abaixo da
 * linha.
 *
 * **O que não mudou:** o `RadioGroup` do headlessui, o `initiatePaymentSession`, o
 * `resolvePayment` do registry (é o adapter que decide como o meio se completa) e
 * todos os `data-testid`.
 *
 * O `paidByGiftcard` continua com o caminho próprio: com o carrinho inteiro pago
 * por vale-presente não há meio a escolher, e o passo mostra o resumo em vez da
 * lista.
 */
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

  const resumoDoPagamento = (
    <div className="rv-fieldset-summary">
      <div>
        <span className="rv-fieldset-label">Forma de pagamento</span>
        <p data-testid="payment-method-summary">Cartão-presente</p>
      </div>
    </div>
  )

  return (
    <fieldset className="rv-fieldset">
      <legend>
        <span>3</span>
        Pagamento
        {!isOpen && paymentReady && (
          <CheckCircleSolid aria-hidden="true" focusable="false" />
        )}
      </legend>

      {isOpen ? (
        <>
          {!paidByGiftcard && availablePaymentMethods?.length && (
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
                  <Fragment key={paymentMethod.id}>
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
                  </Fragment>
                )
              })}
            </RadioGroup>
          )}

          {paidByGiftcard && resumoDoPagamento}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <button
            type="button"
            className="rv-btn rv-btn-primary"
            onClick={handleSubmit}
            disabled={
              isLoading ||
              (needsInlineInput(selectedPaymentMethod) && !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {needsInlineInput(selectedPaymentMethod)
              ? "Informar os dados do cartão"
              : "Continuar para a revisão"}
          </button>
        </>
      ) : (
        <>
          {cart && paymentReady && activeSession ? (
            <>
              <div className="rv-fieldset-action">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rv-form-action"
                  data-testid="edit-payment-button"
                >
                  Editar
                </button>
              </div>
              <div className="rv-fieldset-summary">
                <div>
                  <span className="rv-fieldset-label">Forma de pagamento</span>
                  <p data-testid="payment-method-summary">
                    {resolvePayment(activeSession?.provider_id).label}
                  </p>
                </div>
                <div>
                  <span className="rv-fieldset-label">
                    Detalhes do pagamento
                  </span>
                  <p data-testid="payment-details-summary">
                    {resolvePayment(selectedPaymentMethod).icon || (
                      <CreditCard aria-hidden="true" focusable="false" />
                    )}{" "}
                    {needsInlineInput(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : "O próximo passo aparece aqui"}
                  </p>
                </div>
              </div>
            </>
          ) : paidByGiftcard ? (
            resumoDoPagamento
          ) : (
            <p className="rv-fieldset-note">
              Escolha a forma de entrega acima para ver as formas de pagamento.
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}

export default Payment
