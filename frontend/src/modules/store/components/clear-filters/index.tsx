"use client"

import { usePathname, useRouter } from "next/navigation"

/**
 * "Limpar filtros" — o caminho de volta de uma grade vazia.
 *
 * Ele existe como ilha de cliente por um motivo banal e decisivo: o endereço
 * **sem** filtros é o endereço atual sem a query string, e quem sabe o endereço
 * atual é o navegador (`usePathname`), não o componente de servidor que desenha o
 * vazio. Passar o caminho de volta como prop obrigaria cada rota (catálogo,
 * categoria, coleção) a montá-lo à mão — três lugares para a mesma string.
 *
 * Limpa **tudo**: filtros e ordem. Quem pediu para limpar quer a prateleira como
 * ela nasce.
 */
export default function ClearFilters() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <button
      type="button"
      className="rv-btn rv-btn-secondary"
      onClick={() => router.replace(pathname, { scroll: false })}
      data-testid="clear-filters"
    >
      Limpar filtros
    </button>
  )
}
