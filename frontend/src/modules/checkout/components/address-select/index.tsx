"use client"

import { Listbox } from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { useMemo } from "react"

import compareAddresses from "@lib/util/compare-addresses"

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void
}

/**
 * A lista de endereços salvos da cliente, no passo 1 do checkout.
 *
 * É um `<Listbox>` do headlessui — teclado, `aria-*` e foco são dele —, e o que
 * mudou foi só a roupa: o botão virou um campo (`.rv-address-select-button`), a
 * lista virou uma caixa (`.rv-address-options`) e o ponto de seleção é o
 * `.rv-choice` do resto do checkout, no lugar do rádio do design system.
 *
 * Duas coisas saíram junto com as classes antigas: o anel de foco escrito à mão
 * (`focus-visible:ring-…`, que é uma **segunda** régua de foco — a casa tem uma, no
 * fim do `brand.css`) e a animação de entrada/saída da lista, que era feita com
 * quatro classes de utilitário. A lista abre e fecha; se um dia ela precisar de
 * animação, ela vem escrita no `brand.css`, junto das outras.
 *
 * O texto em inglês ("Choose an address") saiu: a cliente lê "Selecione um
 * endereço".
 */
const AddressSelect = ({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) => {
  const handleSelect = (id: string) => {
    const savedAddress = addresses.find((a) => a.id === id)
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress)
    }
  }

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => compareAddresses(a, addressInput))
  }, [addresses, addressInput])

  return (
    <Listbox onChange={handleSelect} value={selectedAddress?.id}>
      <div className="rv-address-select">
        <Listbox.Button
          className="rv-address-select-button"
          data-testid="shipping-address-select"
        >
          {({ open }) => (
            <>
              <span className="truncate">
                {selectedAddress
                  ? selectedAddress.address_1
                  : "Selecione um endereço"}
              </span>
              <ChevronUpDown
                aria-hidden="true"
                focusable="false"
                data-open={open ? "" : undefined}
              />
            </>
          )}
        </Listbox.Button>
        <Listbox.Options
          className="rv-address-options"
          data-testid="shipping-address-options"
        >
          {addresses.map((address) => {
            const selected = selectedAddress?.id === address.id

            return (
              <Listbox.Option
                key={address.id}
                value={address.id}
                className={clx("rv-address-option", {
                  "rv-option-selected": selected,
                })}
                data-testid="shipping-address-option"
              >
                <span
                  className="rv-choice"
                  aria-hidden="true"
                  data-testid="shipping-address-radio"
                />
                <div className="rv-address-option-body">
                  <strong>
                    {address.first_name} {address.last_name}
                  </strong>
                  {address.company && <span>{address.company}</span>}
                  <p>
                    {address.address_1}
                    {address.address_2 && `, ${address.address_2}`}
                  </p>
                  <p>
                    {address.postal_code}, {address.city}
                  </p>
                  <p>
                    {address.province && `${address.province}, `}
                    {address.country_code?.toUpperCase()}
                  </p>
                </div>
              </Listbox.Option>
            )
          })}
        </Listbox.Options>
      </div>
    </Listbox>
  )
}

export default AddressSelect

