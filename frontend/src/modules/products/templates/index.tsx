import React, { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import Breadcrumb, {
  type ItemDoCaminho,
} from "@modules/common/components/breadcrumb"
import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

/**
 * A página da peça: **foto à esquerda, decisão à direita**.
 *
 * Era a página do starter — informação, galeria e ações em três colunas iguais —,
 * e o defeito não era estético: com a página partida em três, o preço e o tamanho
 * ficavam longe da foto, que é o que faz alguém comprar roupa pela internet. Aqui
 * a galeria ocupa 1,45 da largura, o resumo 0,75, e o resumo **acompanha a
 * rolagem** (`sticky`) enquanto a cliente olha o caimento.
 *
 * O que entrou no resumo: o caminho de volta (o breadcrumb, com a categoria da
 * peça), o título, a descrição, o preço, os seletores de cor e tamanho, o botão
 * de comprar e os detalhes em acordeão — na ordem em que a decisão acontece.
 *
 * OS TRÊS BLOCOS DE DADO DA REFERÊNCIA: MONTADOS, E AINDA DESLIGADOS
 * -------------------------------------------------------------------------
 * A referência desenha, nesta página, três coisas que **não são estado do
 * catálogo**: as estrelas de avaliação, o cálculo de frete por CEP e as parcelas
 * com o valor no Pix. Nenhuma das três é dado do Medusa — e por isso nenhuma foi
 * escrita com número inventado. O que este lote fez foi o **vestir**: o desenho de
 * cada bloco está no `brand.css`, o componente existe e está montado no lugar da
 * referência, e cada um devolve `null` enquanto o dado não chega.
 *
 *   - **As estrelas** (`product-rating`, no cabeçalho do resumo): a loja as
 *     escreve no `metadata` do produto (`rating_media`/`rating_total`), o mesmo
 *     canal de `tag_status` e `care`. Enquanto não houver nota, o bloco não
 *     existe — nota inventada é a loja afirmando o que ninguém disse, e é a
 *     primeira coisa que a cliente confere depois de comprar.
 *   - **O frete e o prazo** (`shipping-quote`, abaixo do botão): o campo de CEP da
 *     referência responde "3 a 5 dias úteis, grátis" para **qualquer** CEP
 *     digitado, e isso é pior do que não ter campo: é promessa por escrito. Aqui o
 *     bloco só aparece com as opções de entrega que o backend calculou para um
 *     CEP — e o que a página diz sobre entrega, hoje, continua no acordeão
 *     "Entrega e trocas", em pt-BR e sem pedir dado nenhum à cliente.
 *   - **As parcelas e o Pix** (`installment-info`, no bloco do preço): o Medusa não
 *     tem parcelamento — quem sabe é o meio de pagamento, no checkout — e o valor
 *     do Pix dependeria de uma regra de desconto que a loja ainda não cadastrou
 *     (o checkout anuncia 5% e o adapter do Mercado Pago não aplica nenhuma).
 */
const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const categoria = product.categories?.[0]

  const caminho: ItemDoCaminho[] = [
    { label: "Início", href: "/" },
    ...(categoria?.handle
      ? [
          {
            label: categoria.name ?? categoria.handle,
            href: `/categories/${categoria.handle}`,
          },
        ]
      : []),
    { label: product.title ?? "" },
  ]

  return (
    <>
      <div className="rv-container pt-6" data-testid="product-container">
        <Breadcrumb items={caminho} />
      </div>

      <div className="rv-container rv-product-detail">
        <ImageGallery images={images} />

        <div className="rv-product-summary">
          <ProductInfo product={product} />

          <Suspense
            fallback={
              <ProductActions
                disabled={true}
                product={product}
                region={region}
              />
            }
          >
            <ProductActionsWrapper id={product.id} region={region} />
          </Suspense>

          <ProductTabs product={product} />

          {/*
            Andaime do starter: só aparece com o cookie de demonstração do
            Medusa, que a loja real nunca escreve. Fica onde está porque o
            caminho de demonstração é funcional — e não porque faz parte do
            desenho desta página.
          */}
          <ProductOnboardingCta />
        </div>
      </div>

      <section className="rv-section-pad" data-testid="related-products-container">
        <div className="rv-container">
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts product={product} countryCode={countryCode} />
          </Suspense>
        </div>
      </section>
    </>
  )
}

export default ProductTemplate

