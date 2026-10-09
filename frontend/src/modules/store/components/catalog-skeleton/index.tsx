import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

/**
 * O catálogo enquanto as peças não chegam.
 *
 * Ele repete a **moldura** da tela de verdade — o respiro, a barra de ferramentas
 * e a grade em três colunas ao lado da barra de filtros — porque um esqueleto
 * serve para a página não pular quando o conteúdo chega. Um esqueleto com outra
 * largura de coluna, ou sem a linha da contagem, desloca a página exatamente no
 * momento em que ela aparece.
 *
 * O que a barra de ferramentas diz aqui é "Carregando peças…", e não "0 peças":
 * um número que a tela ainda não sabe é pior do que a frase que ela sabe.
 */
export default function CatalogSkeleton({
  numberOfProducts = 8,
}: {
  numberOfProducts?: number
}) {
  return (
    <div className="rv-catalog-pad">
      <div className="rv-container">
        <div className="rv-catalog-toolbar">
          <p className="rv-catalog-count">Carregando peças…</p>
        </div>

        <div className="rv-catalog-layout">
          <div className="hidden small:block" aria-hidden="true" />

          <SkeletonProductGrid
            numberOfProducts={numberOfProducts}
            className="rv-catalog-grid"
          />
        </div>
      </div>
    </div>
  )
}
