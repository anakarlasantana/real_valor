import { HttpTypes } from "@medusajs/types"
import { avaliacaoDoProduto } from "@lib/util/product-rating"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductRating from "@modules/products/components/product-rating"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

/**
 * O cabeçalho do resumo da peça: a avaliação, a categoria, o título e a descrição.
 *
 * Usava `Heading` e `Text` do `@medusajs/ui` — e o preço daqui saiu por isso
 * mesmo, na fase da vitrine: o design system impõe tamanho e cor por classe do
 * Tailwind, e **classe do Tailwind ganha de `brand.css`** (que é importado
 * antes). O componente que adota a linguagem da marca tem de largar o utilitário,
 * não conviver com ele; era o único jeito de o título desta página ser o mesmo
 * título de todas as outras.
 *
 * A categoria vira o segundo degrau do caminho de volta, e por isso ela é um
 * link: quem chegou por busca pode querer ver o resto da prateleira.
 *
 * A avaliação abre a coluna, **acima da categoria** — é a ordem da referência
 * (estrelas → categoria → nome), e a pergunta "esta peça é confiável?" vem antes
 * de "que peça é esta?". Quem decide se o bloco existe é `avaliacaoDoProduto`
 * (lê `metadata.rating_media`/`rating_total`, com teste): o catálogo não tem
 * avaliação nenhuma, então hoje o cabeçalho é exatamente o que sempre foi — a
 * montagem está feita e nasce desligada.
 */
const ProductInfo = ({ product }: ProductInfoProps) => {
  const categoria = product.categories?.[0]
  const avaliacao = avaliacaoDoProduto(product)

  return (
    <div id="product-info">
      <ProductRating media={avaliacao?.media} total={avaliacao?.total} />

      {categoria?.handle && (
        <LocalizedClientLink
          href={`/categories/${categoria.handle}`}
          className="rv-eyebrow text-rv-rose-strong transition-colors hover:text-rv-preto"
        >
          {categoria.name ?? categoria.handle}
        </LocalizedClientLink>
      )}

      <h1 className="rv-product-title" data-testid="product-title">
        {product.title}
      </h1>

      {product.description && (
        <p className="rv-product-description" data-testid="product-description">
          {product.description}
        </p>
      )}
    </div>
  )
}

export default ProductInfo
