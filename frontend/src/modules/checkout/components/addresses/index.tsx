"use client"

import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { useToggleState } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState } from "react"

import { setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import Spinner from "@modules/common/icons/spinner"

import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"

/**
 * O passo 1 do checkout — "Seus dados".
 *
 * Ele era o bloco "Shipping Address" do starter: um `Heading` com um lápis de
 * "Edit" (em inglês), os campos do design system e um `Divider` no fim. Agora é o
 * primeiro dos três `<fieldset>` numerados da referência: o número 1 no círculo
 * rosa, "Seus dados" no rótulo, o visto verde quando o passo está preenchido, e o
 * conteúdo ou o resumo do que já foi respondido.
 *
 * **O que não mudou, e não pode mudar:** o `useActionState(setAddresses)`, o
 * `name` de cada campo do formulário (é por eles que o `setAddresses` monta o
 * payload), o `data-testid` de cada coisa e a ordem dos passos. O que mudou é a
 * roupa — e a língua.
 *
 * Sobre o nome do passo: a referência separa "Seus dados" (contato) de "Entrega"
 * (endereço **e** frete). Aqui o endereço vive no passo 1, porque é o mesmo
 * formulário que o `setAddresses` envia de uma vez — separá-lo em dois passos
 * significaria dois envios para o mesmo dado, e um estado intermediário de
 * endereço pela metade. O rótulo é o da referência; o corte é o do Medusa.
 */
const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "address"

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  const [message, formAction] = useActionState(setAddresses, null)

  return (
    <fieldset className="rv-fieldset">
      <legend>
        <span>1</span>
        Seus dados
        {!isOpen && <CheckCircleSolid aria-hidden="true" focusable="false" />}
      </legend>

      {isOpen ? (
        <form action={formAction}>
          <ShippingAddress
            customer={customer}
            checked={sameAsBilling}
            onChange={toggleSameAsBilling}
            cart={cart}
          />

          {!sameAsBilling && (
            <div>
              <h3 className="rv-fieldset-subhead">Endereço de cobrança</h3>
              <BillingAddress cart={cart} />
            </div>
          )}

          <SubmitButton data-testid="submit-address-button">
            Continuar para a entrega
          </SubmitButton>
          <ErrorMessage error={message} data-testid="address-error-message" />
        </form>
      ) : (
        <>
          {cart?.shipping_address && (
            <div className="rv-fieldset-action">
              <button
                type="button"
                onClick={handleEdit}
                className="rv-form-action"
                data-testid="edit-address-button"
              >
                Editar
              </button>
            </div>
          )}

          {cart?.shipping_address ? (
            <div className="rv-fieldset-summary">
              <div data-testid="shipping-address-summary">
                <span className="rv-fieldset-label">Entrega</span>
                <p>
                  {cart.shipping_address.first_name}{" "}
                  {cart.shipping_address.last_name}
                </p>
                <p>
                  {cart.shipping_address.address_1}{" "}
                  {cart.shipping_address.address_2}
                </p>
                <p>
                  {cart.shipping_address.postal_code},{" "}
                  {cart.shipping_address.city}
                </p>
                <p>{cart.shipping_address.country_code?.toUpperCase()}</p>
              </div>

              <div data-testid="shipping-contact-summary">
                <span className="rv-fieldset-label">Contato</span>
                <p>{cart.shipping_address.phone}</p>
                <p>{cart.email}</p>
              </div>

              <div data-testid="billing-address-summary">
                <span className="rv-fieldset-label">Cobrança</span>
                {sameAsBilling ? (
                  <p>Igual ao endereço de entrega.</p>
                ) : (
                  <>
                    <p>
                      {cart.billing_address?.first_name}{" "}
                      {cart.billing_address?.last_name}
                    </p>
                    <p>
                      {cart.billing_address?.address_1}{" "}
                      {cart.billing_address?.address_2}
                    </p>
                    <p>
                      {cart.billing_address?.postal_code},{" "}
                      {cart.billing_address?.city}
                    </p>
                    <p>{cart.billing_address?.country_code?.toUpperCase()}</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </>
      )}
    </fieldset>
  )
}

export default Addresses
