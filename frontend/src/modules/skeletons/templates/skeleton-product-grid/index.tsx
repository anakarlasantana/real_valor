import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

/**
 * A grade de esqueletos — o estado de espera de qualquer lista de peças.
 *
 * A grade é passada por `className`, e não fixa como era, porque o catálogo tem
 * **colunas próprias** (`.rv-catalog-grid`, três colunas ao lado da barra de
 * filtros) e a busca tem as da vitrine. Duas grades diferentes no mesmo
 * componente seriam duas telas discordando sobre quantas peças cabem na linha:
 * o esqueleto mostra 4 colunas, a peça chega em 3, e a página salta. Quem decide
 * a largura é a tela, então quem chama passa a classe.
 */
const GRADE_DA_VITRINE =
  "grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8 flex-1"

const SkeletonProductGrid = ({
  numberOfProducts = 8,
  className = GRADE_DA_VITRINE,
}: {
  numberOfProducts?: number
  /** A grade da tela — ver `.rv-catalog-grid` para o catálogo. */
  className?: string
}) => {
  return (
    <ul className={className} data-testid="products-list-loader">
      {repeat(numberOfProducts).map((index) => (
        <li key={index}>
          <SkeletonProductPreview />
        </li>
      ))}
    </ul>
  )
}

export default SkeletonProductGrid
