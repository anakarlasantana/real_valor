import { HttpTypes } from "@medusajs/types"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"

/**
 * Os campos do passo 1 — os dados da cliente e o endereço de entrega.
 *
 * Eram os `Input` do `@modules/common/components/input` (o campo de rótulo
 * flutuante do starter, com as classes do design system) e viraram marcação nossa
 * dentro do `.rv-form-grid`: o rótulo **acima** do campo, 48px de altura, o halo
 * rosa no foco, a mesma medida da caixa do CEP da página da peça. O `Input`
 * compartilhado continua existindo (a conta o usa), mas o checkout não depende mais
 * dele para ter a cara da loja.
 *
 * Três observações sobre o que mudou:
 *
 *  - os campos ganharam `placeholder`. O campo do starter precisava do rótulo
 *    *dentro* dele para o texto flutuante funcionar, e por isso o `placeholder` era
 *    um espaço; agora o rótulo está fora, e o exemplo pode ser exemplo de verdade
 *    ("Rua, avenida…", "00000-000").
 *  - **entrou o complemento.** A referência separa "Endereço" de "Número" e
 *    "Complemento", e o Medusa tem os dois campos (`address_1` e `address_2`); o
 *    formulário antigo simplesmente não pedia o complemento e gravava
 *    `address_2: ""` (ver `setAddresses`). Quem entrega precisa dele.
 *  - **CPF não entrou**, embora a referência o tenha. O `StoreCartAddress` do
 *    Medusa não tem esse campo: pedi-lo e não gravá-lo seria pedir um dado à toa.
 *    Ele é assunto do cadastro de cliente, não do endereço de entrega.
 */
const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.address_2": cart?.shipping_address?.address_2 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || "",
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    address &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.address_2": address?.address_2 || "",
        "shipping_address.company": address?.company || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || "",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
      }))

    email &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        email: email,
      }))
  }

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart && cart.shipping_address) {
      setFormAddress(cart?.shipping_address, cart?.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [cart]) // Add cart as a dependency

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <div className="rv-saved-addresses">
          <p>
            {`Olá, ${customer.first_name}. Quer usar um dos seus endereços salvos?`}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", "")
              ) as HttpTypes.StoreCartAddress
            }
            onSelect={setFormAddress}
          />
        </div>
      )}
      <div className="rv-form-grid">
        <label className="rv-form-field rv-full">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={formData.email}
            onChange={handleChange}
            required
            data-testid="shipping-email-input"
          />
        </label>
        <label className="rv-form-field">
          Nome
          <input
            name="shipping_address.first_name"
            autoComplete="given-name"
            placeholder="Seu nome"
            value={formData["shipping_address.first_name"]}
            onChange={handleChange}
            required
            data-testid="shipping-first-name-input"
          />
        </label>
        <label className="rv-form-field">
          Sobrenome
          <input
            name="shipping_address.last_name"
            autoComplete="family-name"
            placeholder="Seu sobrenome"
            value={formData["shipping_address.last_name"]}
            onChange={handleChange}
            required
            data-testid="shipping-last-name-input"
          />
        </label>
        <label className="rv-form-field">
          Telefone
          <input
            name="shipping_address.phone"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={formData["shipping_address.phone"]}
            onChange={handleChange}
            data-testid="shipping-phone-input"
          />
        </label>
        <label className="rv-form-field">
          CEP
          <input
            name="shipping_address.postal_code"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={formData["shipping_address.postal_code"]}
            onChange={handleChange}
            required
            data-testid="shipping-postal-code-input"
          />
        </label>
        <label className="rv-form-field rv-full">
          Endereço
          <input
            name="shipping_address.address_1"
            autoComplete="address-line1"
            placeholder="Rua, avenida…"
            value={formData["shipping_address.address_1"]}
            onChange={handleChange}
            required
            data-testid="shipping-address-input"
          />
        </label>
        <label className="rv-form-field">
          Complemento
          <input
            name="shipping_address.address_2"
            autoComplete="address-line2"
            placeholder="Apto, bloco… (opcional)"
            value={formData["shipping_address.address_2"]}
            onChange={handleChange}
            data-testid="shipping-address-2-input"
          />
        </label>
        <label className="rv-form-field">
          Cidade
          <input
            name="shipping_address.city"
            autoComplete="address-level2"
            placeholder="Sua cidade"
            value={formData["shipping_address.city"]}
            onChange={handleChange}
            required
            data-testid="shipping-city-input"
          />
        </label>
        <label className="rv-form-field">
          Estado
          <input
            name="shipping_address.province"
            autoComplete="address-level1"
            placeholder="UF"
            value={formData["shipping_address.province"]}
            onChange={handleChange}
            data-testid="shipping-province-input"
          />
        </label>
        <label className="rv-form-field">
          País
          <CountrySelect
            name="shipping_address.country_code"
            autoComplete="country"
            region={cart?.region}
            value={formData["shipping_address.country_code"]}
            onChange={handleChange}
            required
            data-testid="shipping-country-select"
          />
        </label>
        <label className="rv-form-field rv-full">
          Empresa
          <input
            name="shipping_address.company"
            autoComplete="organization"
            placeholder="Opcional"
            value={formData["shipping_address.company"]}
            onChange={handleChange}
            data-testid="shipping-company-input"
          />
        </label>
      </div>
      <label className="rv-checkbox">
        <input
          type="checkbox"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
        Endereço de cobrança igual ao de entrega
      </label>
    </>
  )
}

export default ShippingAddress
