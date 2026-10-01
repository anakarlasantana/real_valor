import { Container } from "@medusajs/ui"

/**
 * O card em esqueleto, enquanto a lista de produtos não chegou (o `Suspense` do
 * `/store` e o dos relacionados).
 *
 * As três barras são as três linhas do card de verdade — título, preço e botão
 * (`.rv-price` / `.rv-card-cta`, ver `product-preview/index.tsx`), na mesma ordem
 * e com alturas próximas. O esqueleto não precisa acertar o pixel; o que ele não
 * pode é prometer uma caixa de outra altura, senão a página pula no quadro em que
 * o produto entra.
 */
const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse">
      <Container className="aspect-[9/16] w-full bg-gray-100 bg-ui-bg-subtle" />
      <div className="mt-4 flex flex-col gap-y-2">
        <div className="h-5 w-3/5 bg-gray-100"></div>
        <div className="h-6 w-1/4 bg-gray-100"></div>
        <div className="h-11 w-full bg-gray-100"></div>
      </div>
    </div>
  )
}

export default SkeletonProductPreview
