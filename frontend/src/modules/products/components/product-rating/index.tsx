import { Star, StarSolid } from "@medusajs/icons"

import {
  avaliacaoValida,
  estrelasCheiasDaMedia,
  NOTA_MAXIMA,
  rotuloDaAvaliacao,
} from "@lib/util/product-rating"

/**
 * As estrelas de avaliação da peça — "★★★★★ 4,9 · 28 avaliações".
 *
 * Elas abrem o resumo, **acima do título**: é a ordem da referência e a ordem em
 * que a pergunta acontece ("esta peça é confiável?" antes de "que peça é esta?").
 *
 * Ele é burro de propósito, como o `ProductStatusChip`: quem decide se há
 * avaliação — e se o dado que chegou serve — é `avaliacaoValida`
 * (`lib/util/product-rating.ts`), que se testa sem renderizar nada. O que sobra
 * para este arquivo é a conta das estrelas e o texto.
 *
 * **As estrelas são decorativas; o número é que informa.** Elas saem com
 * `aria-hidden` e o texto ao lado carrega tudo: quem usa leitor de tela não ouve
 * cinco glifos, ouve "4,9 · 28 avaliações" — e o rosa do glifo é permitido porque
 * forma não é texto (a regra de contraste está no topo do `brand.css`).
 *
 * **Sem avaliação, nada é desenhado.** O catálogo não tem avaliação nenhuma: quem
 * as escreve é a loja, no `metadata` do produto, e enquanto elas não existirem
 * este componente devolve `null` — a montagem está feita e o bloco nasce desligado.
 * Número inventado seria a loja afirmando o que ninguém disse.
 */
export default function ProductRating({
  media,
  total,
}: {
  media?: number | null
  total?: number | null
}) {
  const avaliacao = avaliacaoValida(media, total)

  if (!avaliacao) {
    return null
  }

  const cheias = estrelasCheiasDaMedia(avaliacao.media)

  return (
    <div className="rv-rating" data-testid="product-rating">
      <span className="rv-rating-stars" aria-hidden="true">
        {/*
          Cinco estrelas sempre, cheias até a nota arredondada: a média exata quem
          diz é o texto ao lado, e a estrela pela metade seria a única forma de a
          média parecer mais precisa do que ela é.
        */}
        {Array.from({ length: NOTA_MAXIMA }, (_, posicao) => {
          const Estrela = posicao < cheias ? StarSolid : Star

          return (
            <Estrela
              key={posicao}
              focusable="false"
              className={
                posicao < cheias
                  ? "rv-rating-star"
                  : "rv-rating-star rv-rating-star-vazia"
              }
            />
          )
        })}
      </span>

      <span className="rv-rating-count" data-testid="product-rating-count">
        {rotuloDaAvaliacao(avaliacao)}
      </span>
    </div>
  )
}
