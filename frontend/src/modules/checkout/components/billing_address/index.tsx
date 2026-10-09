import { HttpTypes } from "@medusajs/types"
import React, { useState } from "react"
import CountrySelect from "../country-select"

/**
 * O endereço de cobrança — o bloco que abre no passo 1 quando a cliente desmarca
 * "endereço de cobrança igual ao de entrega".
 *
 * Ele é o mesmo `.rv-form-grid` dos campos de entrega, e de propósito: os dois são
 * o mesmo tipo de dado (um endereço), pedido duas vezes, e a diferença entre eles é
 * só o título acima. Os `Input` do design system saíram daqui junto com o rótulo
 * flutuante; o que ficou é marcação nossa, com os mesmos `name` e `data-testid` (é
 * por eles que o `setAddresses` monta o payload e que os testes de ponta a ponta
 * acham cada campo).
 *
 * Aqui **não** entrou o número/complemento que a entrega ganhou? Entrou: o campo
 * `address_2` está abaixo do endereço. O que não entrou é o CPF pelo mesmo motivo
 * do outro arquivo — o `StoreCartAddress` do Medusa não tem esse campo.
 */
const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<any>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.address_2": cart?.billing_address?.address_2 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
  })

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
    <div className="rv-form-grid">
      <label className="rv-form-field">
        Nome
        <input
          name="billing_address.first_name"
          autoComplete="given-name"
          placeholder="Seu nome"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
        />
      </label>
      <label className="rv-form-field">
        Sobrenome
        <input
          name="billing_address.last_name"
          autoComplete="family-name"
          placeholder="Seu sobrenome"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
        />
      </label>
      <label className="rv-form-field rv-full">
        Endereço
        <input
          name="billing_address.address_1"
          autoComplete="address-line1"
          placeholder="Rua, avenida…"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="billing-address-input"
        />
      </label>
      <label className="rv-form-field">
        Complemento
        <input
          name="billing_address.address_2"
          autoComplete="address-line2"
          placeholder="Apto, bloco… (opcional)"
          value={formData["billing_address.address_2"]}
          onChange={handleChange}
          data-testid="billing-address-2-input"
        />
      </label>
      <label className="rv-form-field">
        Empresa
        <input
          name="billing_address.company"
          autoComplete="organization"
          placeholder="Opcional"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          data-testid="billing-company-input"
        />
      </label>
      <label className="rv-form-field">
        CEP
        <input
          name="billing_address.postal_code"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
        />
      </label>
      <label className="rv-form-field">
        Cidade
        <input
          name="billing_address.city"
          autoComplete="address-level2"
          placeholder="Sua cidade"
          value={formData["billing_address.city"]}
          onChange={handleChange}
          data-testid="billing-city-input"
        />
      </label>
      <label className="rv-form-field">
        Estado
        <input
          name="billing_address.province"
          autoComplete="address-level1"
          placeholder="UF"
          value={formData["billing_address.province"]}
          onChange={handleChange}
          data-testid="billing-province-input"
        />
      </label>
      <label className="rv-form-field">
        País
        <CountrySelect
          name="billing_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["billing_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="billing-country-select"
        />
      </label>
      <label className="rv-form-field">
        Telefone
        <input
          name="billing_address.phone"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          data-testid="billing-phone-input"
        />
      </label>
    </div>
  )
}

export default BillingAddress
