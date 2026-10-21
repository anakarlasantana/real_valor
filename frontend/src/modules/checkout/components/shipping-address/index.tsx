import { HttpTypes } from "@medusajs/types"
import { formatarDocumento, lerDocumento } from "@rv/contrato"
import { mascararCampoDeEndereco } from "@lib/checkout/mascaras-de-endereco"
import { useCepAutofill } from "@lib/checkout/use-cep-autofill"
import { buscarCep } from "@lib/data/shipping-cep"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useRef, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"

/**
 * Os campos do passo 1: cliente e endereço, em marcação nossa (o CPF é obrigatório
 * — o SuperFrete não emite etiqueta sem ele). Número e bairro (RV-041) vivem em
 * `shipping_address.metadata`; o bairro saiu do `province`, que é a UF.
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
  const documentoDoCarrinho = (cart?.metadata as Record<string, unknown> | null)
    ?.cpf

  /** Número e bairro não são campos do Medusa: eles moram no metadata do endereço. */
  const metadataDoEndereco = (cart?.shipping_address?.metadata ??
    {}) as Record<string, unknown>

  const [formData, setFormData] = useState<Record<string, any>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.numero": String(metadataDoEndereco.numero ?? ""),
    "shipping_address.address_2": cart?.shipping_address?.address_2 || "",
    "shipping_address.bairro": String(metadataDoEndereco.bairro ?? ""),
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    cpf: documentoDoCarrinho ? formatarDocumento(documentoDoCarrinho) : "",
    email: cart?.email || "",
  })

  const documentoLido = lerDocumento(formData.cpf)
  const erroDoDocumento =
    formData.cpf && !documentoLido.valido ? documentoLido.mensagem : null

  const enderecoRef = useRef<HTMLInputElement>(null)
  const numeroRef = useRef<HTMLInputElement>(null)
  const enderecoDoCarrinhoRef = useRef<any>(cart)
  /** Algo foi digitado desde a última carga do carrinho? É o que a carga não pisa. */
  const digitouRef = useRef(false)

  /** O CEP preenche rua, bairro, cidade e estado — nunca a cada tecla. Ver RV-039/RV-041. */
  const {
    buscandoCep,
    erroCep,
    registrarDigitacao,
    esquecerDigitacao,
    aoMudarCep,
    aoSairCep,
    aoTeclarCep,
  } = useCepAutofill("shipping_address", setFormData, {
    buscarCep,
    // O CEP traz a rua inteira e não traz o número: o cursor vai para onde falta.
    aoPreencher: () => (numeroRef.current ?? enderecoRef.current)?.focus(),
  })

  /** O carrinho já vinha com endereço: o carregamento é só o valor inicial do formulário. */
  const temEnderecoSalvo = Boolean(
    cart?.shipping_address?.address_1 || cart?.shipping_address?.postal_code
  )

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
    /** Número e bairro vêm no metadata do endereço (o Medusa não tem os campos). */
    const metadata = (address?.metadata ?? {}) as Record<string, unknown>

    address &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.numero": String(metadata.numero ?? ""),
        "shipping_address.address_2": address?.address_2 || "",
        "shipping_address.bairro": String(metadata.bairro ?? ""),
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
    // Só quando o carrinho troca: o efeito rodava a cada render e o endereço
    // vindo dele voltava por cima do que a cliente digitou.
    const trocou = enderecoDoCarrinhoRef.current !== cart

    enderecoDoCarrinhoRef.current = cart

    const digitou = digitouRef.current

    // O carrinho mudou, ou o endereço chegou depois do primeiro render: o que veio
    // dele pode entrar. Fora disso, o formulário é da cliente.
    if (!trocou && (temEnderecoSalvo || digitou)) return

    esquecerDigitacao()
    digitouRef.current = false

    const temEndereco =
      cart?.shipping_address?.address_1 || cart?.shipping_address?.postal_code

    if (temEndereco) {
      setFormAddress(cart?.shipping_address, cart?.email)
      return
    }

    if (cart?.email || customer?.email) {
      setFormAddress(undefined, cart?.email || customer?.email)
    }
  }, [cart]) // Add cart as a dependency

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const mascarado = mascararCampoDeEndereco(e.target.name, e.target.value)
    const valor = mascarado ?? e.target.value

    registrarDigitacao(e.target.name, valor)
    digitouRef.current = true

    // Funcional, não `{ ...formData }`: o estado deste render perde tecla rápida.
    setFormData((prev) => ({ ...prev, [e.target.name]: valor }))

    // Também do `onChange`: autofill e Enter não disparam `blur`; o hook não
    // repete a busca do mesmo CEP.
    if (e.target.name === "shipping_address.postal_code") {
      aoMudarCep(valor)
    }
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
          CPF
          <input
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={(e) =>
              setFormData({
                ...formData,
                cpf: formatarDocumento(e.target.value),
              })
            }
            required
            aria-invalid={Boolean(erroDoDocumento)}
            aria-describedby="cpf-hint"
            data-testid="shipping-cpf-input"
          />
          {erroDoDocumento ? (
            <span className="rv-form-hint rv-form-hint-error" id="cpf-hint">
              {erroDoDocumento}
            </span>
          ) : (
            <span className="rv-form-hint" id="cpf-hint">
              Obrigatório para emitir a etiqueta de envio.
            </span>
          )}
        </label>
        <label className="rv-form-field">
          Telefone
          <input
            name="shipping_address.phone"
            autoComplete="tel"
            inputMode="tel"
            maxLength={15}
            placeholder="(00) 00000-0000"
            value={formData["shipping_address.phone"]}
            onChange={handleChange}
            required
            data-testid="shipping-phone-input"
          />
        </label>
        <label className="rv-form-field">
          CEP
          <input
            name="shipping_address.postal_code"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            value={formData["shipping_address.postal_code"]}
            onChange={handleChange}
            onBlur={(e) => aoSairCep(e.target.value)}
            onKeyDown={aoTeclarCep}
            required
            aria-busy={buscandoCep}
            aria-describedby={erroCep ? "shipping-cep-erro" : undefined}
            data-testid="shipping-postal-code-input"
          />
          {buscandoCep && (
            <span
              className="rv-form-hint"
              role="status"
              aria-live="polite"
              data-testid="shipping-cep-buscando"
            >
              Buscando endereço…
            </span>
          )}
          {erroCep && (
            <span
              id="shipping-cep-erro"
              className="rv-form-hint"
              role="alert"
              data-testid="shipping-cep-erro"
            >
              {erroCep}
            </span>
          )}
        </label>
        <label className="rv-form-field rv-full">
          Endereço
          <input
            ref={enderecoRef}
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
          Número
          <input
            ref={numeroRef}
            name="shipping_address.numero"
            inputMode="numeric"
            autoComplete="off"
            placeholder="123"
            maxLength={10}
            value={formData["shipping_address.numero"]}
            onChange={handleChange}
            required
            data-testid="shipping-address-number-input"
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
          Bairro
          <input
            name="shipping_address.bairro"
            autoComplete="address-level3"
            placeholder="Bela Vista"
            value={formData["shipping_address.bairro"]}
            onChange={handleChange}
            required
            data-testid="shipping-neighborhood-input"
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
