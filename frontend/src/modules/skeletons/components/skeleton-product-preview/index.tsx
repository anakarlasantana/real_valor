/**
 * O card em esqueleto, enquanto a lista de produtos não chegou (o `Suspense` do
 * `/store` e o dos relacionados).
 *
 * As barras são a **ordem** do card de verdade — categoria, nome, preço — e a
 * caixa de cima é a foto: 3/4, de borda a borda, sem moldura, que é o desenho do
 * card (`.rv-card-media .rv-thumb`, em `brand.css`). O esqueleto não precisa
 * acertar o pixel; o que ele não pode é prometer uma caixa de outra altura, senão
 * a página pula no quadro em que o produto entra.
 *
 * A foto é o único lugar em que este arquivo pede uma classe do card
 * (`.rv-card-media`): é ela que dá a proporção e a cor de fundo, e repetir a
 * conta aqui seria a segunda régua que o redesenho tirou. O bloco de baixo
 * também usa `.rv-card-info`, pelo mesmo motivo — o respiro entre as linhas é o
 * mesmo, hoje e quando o card mudar.
 */
const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse">
      <div className="rv-card-media">
        {/*
          A caixa da foto é a do card, com a **proporção** e o fundo dela
          (`aspect-ratio: 3/4` e `--rv-rose-soft`, por `.rv-card-media .rv-thumb`):
          o retângulo do esqueleto é o mesmo — na forma, na cor e no lugar — onde a
          foto vai nascer. A régua fica num lugar só; pedir `aspect-[3/4]` aqui
          seria a segunda cópia dela, e a que fica velha primeiro.
        */}
        <div className="rv-thumb w-full" />
      </div>
      <div className="rv-card-info">
        {/* Categoria (8px), nome (18px) e preço (13px): as três linhas do card. */}
        <div className="h-2 w-1/3 bg-gray-100"></div>
        <div className="h-5 w-3/5 bg-gray-100"></div>
        <div className="h-4 w-1/4 bg-gray-100"></div>
      </div>
    </div>
  )
}

export default SkeletonProductPreview
