import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * O caminho de volta — "Início / Alfaiataria / Blazer Cacau".
 *
 * Ele existe como componente porque a página do catálogo e a da peça desenham o
 * mesmo caminho a partir de listas diferentes (aqui, os pais da categoria; lá, a
 * categoria da peça), e duas cópias divergiriam na primeira mudança de separador.
 *
 * O último item **não é link** e carrega `aria-current="page"`: um link para onde
 * já se está é um clique que não faz nada. Item sem `href` no meio da lista
 * também não vira link — quem chama decide o que é destino, e o componente não
 * adivinha.
 */
export type ItemDoCaminho = {
  label: string
  href?: string
}

export default function Breadcrumb({
  items,
  className,
}: {
  items: ItemDoCaminho[]
  className?: string
}) {
  return (
    <nav
      className={["rv-breadcrumb", className].filter(Boolean).join(" ")}
      aria-label="Você está aqui"
      data-testid="breadcrumb"
    >
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <LocalizedClientLink
              href={item.href}
              className="transition-colors hover:text-rv-rose"
            >
              {item.label}
            </LocalizedClientLink>
          ) : (
            <span aria-current={index === items.length - 1 ? "page" : undefined}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
