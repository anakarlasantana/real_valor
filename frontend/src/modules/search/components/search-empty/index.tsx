import { MagnifyingGlass } from "@medusajs/icons"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Os dois vazios da busca, no mesmo lugar — porque são o mesmo vazio.
 *
 * A página de busca tem exatamente dois momentos em que não há peça para
 * mostrar: antes de qualquer termo (a cliente chegou aqui e ainda não
 * escreveu nada) e depois de um termo que não encontrou nada. O desenho
 * dos dois é o mesmo — `.rv-empty-state` —, e a única coisa que muda é o
 * que se diz: no primeiro caso a página convida, no segundo ela explica.
 *
 * Separá-los em dois arquivos deixaria a mesma moldura escrita duas vezes,
 * com o risco conhecido de as duas versões divergirem no dia em que a
 * terceira aparecer. Aqui a diferença é uma condicional, e o ícone, o
 * destino do botão e a razão de existir do bloco são os mesmos.
 *
 * A saída é sempre o catálogo inteiro: quem não achou o que procurava
 * ainda está comprando.
 */
export default function SearchEmpty({ query }: { query?: string }) {
  if (!query) {
    return (
      <EmptyState
        icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
        title="Comece pela peça"
        text="Escreva o nome da peça, a cor ou a ocasião — ou toque numa das sugestões acima."
      >
        <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
          Ver todas as peças
        </LocalizedClientLink>
      </EmptyState>
    )
  }

  return (
    <EmptyState
      icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
      title={`Nada encontrado para “${query}”`}
      text="Confira a escrita ou tente uma palavra mais curta. A busca procura no nome da peça, na descrição e na categoria."
      data-testid="search-empty-state"
    >
      <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
        Ver todas as peças
      </LocalizedClientLink>
    </EmptyState>
  )
}
