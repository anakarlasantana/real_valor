"use client"

import { RadioGroup } from "@headlessui/react"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"

import { initiatePaymentSession } from "@lib/data/cart"
import {
  MEIO_MANUAL_DO_MEDUSA,
  needsInlineInput,
  resolvePayment,
} from "@lib/payments"
import { lerDocumento } from "@rv/contrato"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"

// O texto de uma recusa (`""` passa pelo `??`, e o `ErrorMessage` o trata como
// "sem erro").
const mensagemDaRecusa = (err: unknown): string => {
  const mensagem =
    typeof (err as any)?.message === "string" ? (err as any).message : ""

  return mensagem.trim()
    ? mensagem
    : "Não foi possível iniciar o pagamento agora. Tente novamente em instantes."
}

/**
 * O passo 3 do checkout — "Pagamento".
 *
 * Era o bloco "Payment" do starter (`Heading`, link "Editar" e o azul da Medusa);
 * agora é o terceiro `<fieldset>` numerado, com as opções no cartão
 * `.rv-payment-option` e o formulário do cartão logo abaixo da linha. O
 * `RadioGroup`, o `initiatePaymentSession`, o `resolvePayment` e os `data-testid`
 * não mudaram. O `paidByGiftcard` segue com caminho próprio: carrinho inteiro
 * pago por vale-presente mostra o resumo, não a lista.
 */
const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  // O meio manual do Medusa não conta como sessão ativa: `pp_system_default`
  // pendente (de antes do filtro) não pode terminar a compra sem cobrança.
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) =>
      paymentSession.status === "pending" &&
      paymentSession.provider_id !== MEIO_MANUAL_DO_MEDUSA
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const sessaoCriadaAqui = useRef<Set<string>>(new Set())

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
      try {
        await initiatePaymentSession(cart, {
          provider_id: method,
        })
        sessaoCriadaAqui.current.add(method)
      } catch (err) {
        setError(mensagemDaRecusa(err))
      }
    }
  }

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const documento = lerDocumento(
    (cart?.metadata as Record<string, unknown> | null)?.cpf
  )
  const faltaDocumento = !documento.valido

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
    router.replace(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    if (faltaDocumento) {
      setError(
        "Informe o CPF no passo 1 — ele é obrigatório para emitir a etiqueta de envio."
      )
      return
    }

    setIsLoading(true)
    try {
      // **Este é o ponto de desacoplamento do RV-002.** Antes era
      // `isStripeLike(...) && !activeSession` — o fluxo perguntava ao PROVEDOR
      // "este meio precisa de cartão na minha página?". Agora pergunta ao
      // REGISTRO "como este meio se completa?": `redirect` vai para o Checkout
      // Pro do provedor, `inline` desenha aqui, `external` é só finalizar.
      const inlineInput = needsInlineInput(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod ||
        sessaoCriadaAqui.current.has(selectedPaymentMethod)

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
        sessaoCriadaAqui.current.add(selectedPaymentMethod)
      }

      if (!inlineInput) {
        return router.replace(pathname + "?step=review", { scroll: false })
      }
    } catch (err) {
      setError(mensagemDaRecusa(err))
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

          {faltaDocumento && (
            <p className="rv-form-error" data-testid="payment-missing-document">
              Volte ao passo 1 e informe o CPF: sem ele não há etiqueta.
            </p>
          )}

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
              faltaDocumento ||
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
