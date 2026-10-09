"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * A ordem do catálogo — agora um `<select>`, e não uma lista de rádios.
 *
 * A ordem é uma decisão de segundo plano: quem entra no catálogo quer ver as
 * peças, e a lista de rádios dentro da barra lateral dava a ela o mesmo peso
 * visual dos filtros. O redesenho a coloca na barra de ferramentas, como seletor
 * ("Ordenar por ▾"), e é onde ela é procurada.
 *
 * Três opções, e nenhuma a mais: as três que a loja sabe aplicar (`sortProducts`,
 * em `lib/util/sort-products.ts`). Um "Melhor avaliadas" no seletor precisaria de
 * dado que o catálogo não tem, e um seletor que não ordena é pior do que não ter
 * seletor.
 *
 * **O padrão não vai para a URL.** Escolher "Mais recentes" devolve o endereço
 * limpo (sem `sortBy`), porque é o mesmo que a página faz quando ninguém escolheu
 * nada: dois endereços para a mesma lista é o defeito de duas verdades.
 */
export type SortOptions = "price_asc" | "price_desc" | "created_at"

export const DEFAULT_SORT: SortOptions = "created_at"

const sortOptions: { value: SortOptions; label: string }[] = [
  { value: "created_at", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
]

export default function SortProducts({
  sortBy,
  "data-testid": dataTestId,
}: {
  sortBy: SortOptions
  "data-testid"?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === DEFAULT_SORT) {
      params.delete("sortBy")
    } else {
      params.set("sortBy", value)
    }

    const search = params.toString()

    router.push(search ? `${pathname}?${search}` : pathname)
  }

  return (
    <label className="rv-sort">
      Ordenar por{" "}
      <select
        value={sortBy}
        onChange={(event) => handleChange(event.target.value)}
        data-testid={dataTestId}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

