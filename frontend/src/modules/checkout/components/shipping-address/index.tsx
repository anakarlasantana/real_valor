import { HttpTypes } from "@medusajs/types"
import {
  CEP_DIGITOS,
  formatarCep,
  formatarDocumento,
  lerDocumento,
} from "@rv/contrato"
import { enderecoDoCep } from "@lib/checkout/endereco-pelo-cep"
import { mascararCampoDeEndereco } from "@lib/checkout/mascaras-de-endereco"
import { buscarCep } from "@lib/data/shipping-cep"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useRef, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"

/**
 * Os campos do passo 1 — os dados da cliente e o endereço de entrega.
 *
 * Marcação nossa no `.rv-form-grid` (rótulo acima, 48px, halo rosa), não os
 * `Input` do starter: o `placeholder` virou exemplo de verdade, o complemento
 * entrou (`address_2`, que o form antigo gravava vazio) e o CPF é obrigatório —
 * o SuperFrete não emite etiqueta sem ele, e ninguém deve descobrir isso depois
 * de pagar. (O tamanho disto foi metade do motivo de `renderToStaticMarkup` ter
 * escondido um handler ausente; ver RV-040.)
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
    cpf: documentoDoCarrinho ? formatarDocumento(documentoDoCarrinho) : "",
    email: cart?.email || "",
  })

  const documentoLido = lerDocumento(formData.cpf)
  const erroDoDocumento =
    formData.cpf && !documentoLido.valido ? documentoLido.mensagem : null

  /**
   * O CEP preenche rua, cidade e estado no `onBlur`/Enter — nunca a cada tecla.
   * `buscandoCep` é o único estado que re-renderiza o componente, e o efeito do
   * carrinho rodava a cada render: ligar o aviso apagava o CEP.
   */
  const [buscandoCep, setBuscandoCep] = useState(false)
  /** Por que a busca não trouxe endereço: a única evidência de que ela rodou. RV-040. */
  const [erroCep, setErroCep] = useState<string | null>(null)
  const enderecoRef = useRef<HTMLInputElement>(null)
  const cepCarregadoRef = useRef("")
  const enderecoDoCarrinhoRef = useRef<any>(cart)

  /** O carrinho já vinha com endereço: o carregamento é só o valor inicial do formulário. */
  const temEnderecoSalvo = Boolean(
    cart?.shipping_address?.address_1 || cart?.shipping_address?.postal_code
  )

  /** Só o que a cliente digitou, para a busca não pisar nisso. */
  const digitadoRef = useRef<Record<string, string>>({})
  /**
   * Quantas buscas de CEP vieram. `0` = nada veio de CEP desde que a cliente
   * mexeu em cidade/UF (ou desde a carga): o que está no campo é dela.
   */
  const buscasRef = useRef(0)

  /** A busca em voo, para não gravar a resposta de um CEP quando ela é de outro. */
  const requisicaoRef = useRef(0)

  /** A cliente digitou a cidade/UF desde a carga? É o que o CEP não sobrescreve. */
  const campoDigitado = (campo: "address_1" | "city" | "province") =>
    campo === "address_1"
      ? Boolean(digitadoRef.current.address_1)
      : buscasRef.current === 0

  const registrarDigitacao = (nome: string, valor: string) => {
    if (!nome.startsWith("shipping_address.")) return

    const campo = nome.replace("shipping_address.", "")

    digitadoRef.current[campo] = valor

    // Mexeu na cidade/UF: essas duas passam a ser dela, não do CEP.
    if (campo === "city" || campo === "province") buscasRef.current = 0
  }

  /** A busca falhou de vez: a tela diz isso, em vez de ficar muda. */
  const avisar = () =>
    setErroCep(
      "Não foi possível buscar o CEP agora. Preencha o endereço à mão."
    )

  const preencherPeloCep = async (cepDigitado: string) => {
    const cep = formatarCep(cepDigitado).replace(/\D/g, "")

    // CEP incompleto, ou o mesmo que já está na tela: não refaz o pedido.
    if (cep.length !== CEP_DIGITOS || cepCarregadoRef.current === cep) {
      return
    }

    cepCarregadoRef.current = cep
    const pedido = ++requisicaoRef.current
    setErroCep(null)
    setBuscandoCep(true)

    try {
      const resultado = await buscarCep(cep)

      // A cliente já pediu outro CEP: esta resposta chegou tarde.
      if (pedido !== requisicaoRef.current) return

      if (!resultado.encontrado) {
        // Deixa tentar de novo: erro de rede não é "este CEP não tem endereço".
        cepCarregadoRef.current = ""

        setErroCep(
          resultado.motivo === "cep-inexistente"
            ? "CEP não encontrado. Confira os números."
            : "Não foi possível buscar o CEP agora. Preencha o endereço à mão."
        )
        return
      }

      const { endereco } = resultado
      setFormData((prev: Record<string, any>) => {
        const preenchido = enderecoDoCep(
          {
            address_1: prev["shipping_address.address_1"] || "",
            city: prev["shipping_address.city"] || "",
            province: prev["shipping_address.province"] || "",
          },
          endereco,
          {
            address_1: campoDigitado("address_1"),
            city: campoDigitado("city"),
            province: campoDigitado("province"),
          }
        )

        return {
          ...prev,
          "shipping_address.address_1": preenchido.address_1,
          "shipping_address.city": preenchido.city,
          "shipping_address.province": preenchido.province,
        }
      })

      // A partir daqui, cidade e UF no campo são do CEP, não da cliente.
      buscasRef.current += 1

      // A cliente volta o cursor para o endereço, onde falta o número.
      enderecoRef.current?.focus()
    } finally {
      setBuscandoCep(false)
    }
  }

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
    // Só quando o carrinho troca: o efeito rodava a cada render e o endereço
    // vindo dele voltava por cima do que a cliente digitou.
    const trocou = enderecoDoCarrinhoRef.current !== cart

    enderecoDoCarrinhoRef.current = cart

    const digitou =
      digitadoRef.current.address_1 ||
      digitadoRef.current.city ||
      digitadoRef.current.postal_code

    // O carrinho mudou, ou o endereço chegou depois do primeiro render: o que veio
    // dele pode entrar. Fora disso, o formulário é da cliente.
    if (!trocou && (temEnderecoSalvo || digitou)) return

    digitadoRef.current = {}
    buscasRef.current = 0

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

    // Funcional, não `{ ...formData }`: o estado deste render perde tecla rápida.
    setFormData((prev) => ({ ...prev, [e.target.name]: valor }))

    // Também do `onChange`: autofill e Enter não disparam `blur`; o `cepCarregadoRef`
    // impede repetir a busca a cada tecla.
    if (e.target.name === "shipping_address.postal_code") {
      const digitos = formatarCep(valor).replace(/\D/g, "")

      if (digitos.length === CEP_DIGITOS) {
        void preencherPeloCep(valor).catch(avisar)
      }
    }
  }

  /** Enter no CEP dispara a busca, como o botão que a loja não tem. */
  const handleCepKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      void preencherPeloCep(e.currentTarget.value)
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
            onBlur={(e) => void preencherPeloCep(e.target.value).catch(avisar)}
            onKeyDown={handleCepKeyDown}
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
