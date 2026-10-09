import { MagnifyingGlass } from "@medusajs/icons"
import { Metadata } from "next"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "404",
  description: "Não encontramos esta página",
}

/**
 * O 404 do checkout — a rota de fora do cromo da loja (sem cabeçalho e sem
 * rodapé), que é o caso do endereço de checkout guardado sem carrinho.
 *
 * Ele dizia o mesmo texto em inglês do 404 da loja, com o link "Go to frontpage".
 * Aqui o caminho de volta é a loja inteira, porque o checkout não tem para onde
 * voltar.
 */
export default function NotFound() {
  return (
    <main className="rv-page-shell">
      <EmptyState
        icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
        title="Não encontramos esta página"
        text="Não há nada para finalizar aqui agora — a compra começa na vitrine."
      >
        <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
          Ver todas as peças
        </LocalizedClientLink>
      </EmptyState>
    </main>
  )
}
