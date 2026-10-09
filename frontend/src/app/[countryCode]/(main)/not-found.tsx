import { MagnifyingGlass } from "@medusajs/icons"
import { Metadata } from "next"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "404",
  description: "Não encontramos esta página",
}

/**
 * A página que não existe — em português, e no vazio da casa.
 *
 * O título já estava traduzido; o corpo dizia "The page you tried to access does
 * not exist." e o botão, "Go to frontpage": o mesmo defeito do RV-003, na tela em
 * que a cliente já está perdida. Agora ele usa o `EmptyState` da loja — o mesmo
 * componente do vazio da busca e da sacola —, então um 404 tem a mesma forma de
 * qualquer outro "não tem nada aqui".
 *
 * O caminho de volta é o catálogo, e não a home: quem se perde no meio da compra
 * quer continuar comprando.
 */
export default function NotFound() {
  return (
    <main className="rv-page-shell">
      <EmptyState
        icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
        title="Não encontramos esta página"
        text="O endereço pode ter mudado de lugar ou nunca ter existido. Veja as peças que estão no ar."
      >
        <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
          Ver todas as peças
        </LocalizedClientLink>
      </EmptyState>
    </main>
  )
}
