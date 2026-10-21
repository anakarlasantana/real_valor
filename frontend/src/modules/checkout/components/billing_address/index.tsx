import { HttpTypes } from "@medusajs/types"
import { mascararCampoDeEndereco } from "@lib/checkout/mascaras-de-endereco"
import { useCepAutofill } from "@lib/checkout/use-cep-autofill"
import { buscarCep } from "@lib/data/shipping-cep"
import React, { useState } from "react"
import CountrySelect from "../country-select"

/**
 * O endereço de cobrança — abre no passo 1 quando a cliente desmarca "igual ao
 * de entrega". Mesma marcação da entrega: os `name`/`data-testid` são o contrato
 * com o `setAddresses` e com os testes. A busca de CEP daqui não existia
 * (RV-038); número e bairro vivem no `metadata` do endereço (RV-041).
 */
const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  /** Número e bairro não são campos do Medusa: eles moram no metadata do endereço. */
  const metadataDoEndereco = (cart?.billing_address?.metadata ??
    {}) as Record<string, unknown>

  const [formData, setFormData] = useState<any>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.numero": String(metadataDoEndereco.numero ?? ""),
    "billing_address.address_2": cart?.billing_address?.address_2 || "",
    "billing_address.bairro": String(metadataDoEndereco.bairro ?? ""),
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
  })

  const { buscandoCep, erroCep, registrarDigitacao, aoMudarCep, aoSairCep, aoTeclarCep } =
    useCepAutofill("billing_address", setFormData, { buscarCep })

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const mascarado = mascararCampoDeEndereco(e.target.name, e.target.value)
    const valor = mascarado ?? e.target.value

    registrarDigitacao(e.target.name, valor)

    // Funcional, não `{ ...formData }`: o estado deste render perde tecla rápida.
    setFormData((prev: Record<string, any>) => ({ ...prev, [e.target.name]: valor }))

    if (e.target.name === "billing_address.postal_code") {
      aoMudarCep(valor)
    }
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
        Número
        <input
          name="billing_address.numero"
          inputMode="numeric"
          autoComplete="off"
          placeholder="123"
          maxLength={10}
          value={formData["billing_address.numero"]}
          onChange={handleChange}
          required
          data-testid="billing-address-number-input"
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
        Bairro
        <input
          name="billing_address.bairro"
          autoComplete="address-level3"
          placeholder="Bela Vista"
          value={formData["billing_address.bairro"]}
          onChange={handleChange}
          required
          data-testid="billing-neighborhood-input"
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
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          onBlur={(e) => aoSairCep(e.target.value)}
          onKeyDown={aoTeclarCep}
          required
          aria-busy={buscandoCep}
          aria-describedby={erroCep ? "billing-cep-erro" : undefined}
          data-testid="billing-postal-input"
        />
        {buscandoCep && (
          <span
            className="rv-form-hint"
            role="status"
            aria-live="polite"
            data-testid="billing-cep-buscando"
          >
            Buscando endereço…
          </span>
        )}
        {erroCep && (
          <span
            id="billing-cep-erro"
            className="rv-form-hint"
            role="alert"
            data-testid="billing-cep-erro"
          >
            {erroCep}
          </span>
        )}
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
          inputMode="tel"
          maxLength={15}
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
