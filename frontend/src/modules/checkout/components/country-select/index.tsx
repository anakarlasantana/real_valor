"use client"

import { ChevronUpDown } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import {
  SelectHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"

/**
 * O seletor de país, no passo 1 do checkout.
 *
 * Ele era uma casca em volta do `NativeSelect` — e o `NativeSelect` traz as
 * classes do design system (`border-ui-border-base`, `bg-ui-bg-subtle`,
 * `rounded-md`), que é a segunda régua que o `brand.css` não alcança. Aqui o
 * `<select>` é o mesmo (nativo, porque é o único que abre a lista do sistema no
 * celular), mas vestido pelo `.rv-select`: a seta entra como irmão do campo, e não
 * como fundo decorativo.
 *
 * O `placeholder` continua sendo uma `<option>` desabilitada de valor vazio — é ela
 * que faz o `required` do campo funcionar: sem uma opção vazia selecionável, o
 * navegador aceitaria "Brasil" como se ninguém tivesse escolhido nada.
 */
export type CountrySelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  placeholder?: string
  region?: HttpTypes.StoreRegion
}

const CountrySelect = forwardRef<HTMLSelectElement, CountrySelectProps>(
  ({ placeholder = "Selecione o país", region, ...props }, ref) => {
    const innerRef = useRef<HTMLSelectElement>(null)

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    )

    const countryOptions = useMemo(
      () =>
        region?.countries?.map((country) => ({
          value: country.iso_2,
          label: country.display_name,
        })) ?? [],
      [region]
    )

    return (
      <div className="rv-select">
        <select ref={innerRef} {...props}>
          <option disabled value="">
            {placeholder}
          </option>
          {countryOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronUpDown aria-hidden="true" focusable="false" />
      </div>
    )
  }
)

CountrySelect.displayName = "CountrySelect"

export default CountrySelect
