import { ShoppingBag } from "@medusajs/icons"
import { Metadata } from "next"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "404",
  description: "Não encontramos esta sacola",
}

/**
 * A sacola que não existe — quando o carrinho guardado no cookie já não existe no
 * backend (ele expira, e a cliente fica com o endereço /cart no histórico).
 *
 * O texto estava em inglês e mandava "clear your cookies" — instrução técnica para
 * quem só queria ver o que tinha na sacola. A sacola vazia é o estado normal de
 * quem chega aqui, e é isso que a página diz.
 */
export default function NotFound() {
  return (
    <main className="rv-page-shell">
      <EmptyState
        icon={<ShoppingBag aria-hidden="true" focusable="false" />}
        title="Sua sacola está vazia"
        text="A sacola que estava guardada aqui não existe mais. Escolha uma peça e a gente começa de novo."
      >
        <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
          Explorar a coleção
        </LocalizedClientLink>
      </EmptyState>
    </main>
  )
}
