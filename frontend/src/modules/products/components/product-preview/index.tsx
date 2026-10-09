import { getProductPrice } from "@lib/util/get-product-price"
import { categoriaDaPeca } from "@lib/util/product-enrichment"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductStatusChip from "../product-status-chip"
import Thumbnail from "../thumbnail"
import ColorSwatches from "./color-swatches"
import PreviewPrice from "./price"

/**
 * O card de produto — a peça em todos os lugares em que a loja a lista (vitrine
 * da home, trilhos de lançamentos e destaques, catálogo, relacionados, busca).
 *
 * A estrutura é a da régua do redesenho, e são três blocos:
 *
 *   1. **A foto — e sobre ela, a etiqueta do estado.** A proporção, o fundo e o
 *      corte são do `brand.css` (`.rv-card-media .rv-thumb`); o zoom no ponteiro
 *      também. A etiqueta é o **chip de estado** ("Pronta entrega", "Últimas
 *      peças"…), posicionado no canto da foto por `className` — que é o que o
 *      componente foi feito para receber (ver `product-status-chip`). Quem decide
 *      **qual** dos quatro estados é `productStatus`
 *      (`lib/util/product-availability.ts`), a mesma função que a página do
 *      produto usa: o card e a página não podem discordar sobre a peça.
 *   2. **O convite** ("Ver detalhes"), no pé da foto, escondido até o ponteiro
 *      chegar. Ele **não é um `<button>`**: o card inteiro já é um link, e um
 *      controle dentro de outro seria HTML inválido — o que ele empresta do
 *      botão é a moldura, o alvo e a promessa de clique. Onde não há ponteiro ele
 *      não existe (`@media (hover: hover)`, em `brand.css`), e o caminho para a
 *      peça continua sendo o que sempre foi: o card inteiro.
 *   3. **A informação da peça** — categoria, nome com as cores ao lado e preço. A
 *      categoria sai de `categoriaDaPeca` (`lib/util/product-enrichment.ts`), a
 *      **mesma leitura** da página da peça; aqui ela é **texto**, e não o link
 *      que ela é lá: `<a>` dentro de `<a>` é HTML inválido (o navegador desfaz o
 *      de dentro, e o mesmo toque passa a ter dois destinos conforme o pixel) —
 *      o mesmo motivo pelo qual as bolinhas de cor também não são clicáveis (ver
 *      `./color-swatches.tsx`).
 *
 * O que **saiu** deste arquivo, e por quê:
 *
 *   - **O botão "Comprar" sempre visível**, de largura inteira e abaixo do preço.
 *     Ele existia porque no toque não há hover para revelar um convite escondido —
 *     mas o convite nunca foi o caminho para a peça, e sim a moldura de um alvo
 *     que já ocupava o card todo. Ver o item 2 acima.
 *   - **O chip de estado na linha do preço**, para onde ele havia descido. A
 *     régua o quer **sobre a foto**, como selo — e o que sobra abaixo é a peça.
 *   - **O nome em rosa no hover** (`group-hover:text-rv-rose`): o rosa da marca
 *     não alcança o contraste mínimo para texto deste tamanho, e a regra de
 *     acessibilidade que o mede está no `brand.css`. Quem responde ao ponteiro é
 *     o movimento — o zoom da foto e o convite que sobe.
 *
 * O card **não sabe** que está num carrossel: quem o apaga quando o ponteiro
 * aponta o vizinho é o CSS do trilho (`.rv-carousel`, em `brand.css`), e quem
 * mede a página é a ilha (`product-carousel/index.tsx`). O `isFeatured` que
 * chega aqui é o repasse da seção, e só escolhe o `sizes` da foto (o trilho é
 * mais largo que a coluna da grade). Aqui só mora o que o card é em qualquer
 * lugar em que a loja o liste.
 */
export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  const cover = product.thumbnail || product.images?.[0]?.url
  const hoverImage =
    (product.images ?? []).find((image) => image.url !== cover)?.url ?? null
  const categoria = categoriaDaPeca(product)

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      /*
       * `group` é do Tailwind (a segunda foto do card, que aparece no hover — o
       * `group-hover` está no `thumbnail`) e `rv-card` é do `brand.css`: é ele que
       * acende o convite e dá o zoom na foto quando o ponteiro entra no card. Duas
       * classes porque são duas folhas — o utilitário é emitido depois do
       * `brand.css` e venceria qualquer regra de `:hover` escrita lá.
       */
      className="group rv-card block"
    >
      <div data-testid="product-wrapper">
        <div className="rv-card-media">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            hoverImage={hoverImage}
            size="full"
            isFeatured={isFeatured}
          />
          {/*
            A etiqueta do estado, no canto da foto. É o chip de sempre — mesma
            função, mesmos quatro rótulos, mesmo pulso em "últimas peças" — só
            que posicionado: a posição e a escala são do `brand.css`
            (`.rv-card-tag`), e nada aqui repete tipografia.
          */}
          <ProductStatusChip product={product} className="rv-card-tag" />
          {/*
            O convite. Ele é a **moldura** de um clique que já é do card inteiro
            (ver o comentário do topo): por isso é `<span>`, e não `<button>` — e
            por isso o texto dele entra no nome acessível do link, dizendo a quem
            usa leitor de tela para onde o card leva.
          */}
          <span className="rv-card-cta rv-eyebrow">Ver detalhes</span>
        </div>
        <div className="rv-card-info">
          {/*
            A categoria, em letra miúda, acima do nome: é o contexto da peça
            ("Alfaiataria", "Vestidos"). Peça sem categoria cadastrada não desenha
            nada aqui (`categoriaDaPeca` devolve `null`) — a linha não fica vazia,
            e o card não fica mais alto do que o das outras.
          */}
          {categoria && (
            <span className="rv-eyebrow rv-card-category">{categoria}</span>
          )}
          {/*
            Nome e cores na mesma linha — o nome à esquerda, as cores encostadas na
            direita, que é onde a régua as põe. Quem cuida de a linha quebrar (o
            card tem 167px no celular) é o `flex-wrap` do `brand.css`.
          */}
          <div className="rv-card-name">
            <span className="rv-display rv-card-title" data-testid="product-title">
              {product.title}
            </span>
            <ColorSwatches product={product} />
          </div>
          {/*
            O preço fecha o card — sozinho na linha dele, como na régua. O
            tamanho e a cor são do `brand.css` (`.rv-card-info .rv-price-value`:
            13px em preto, 16:1 sobre o off-white da página).

            A linha de parcelamento que a régua escreve abaixo do preço **não
            está aqui**: o número é do meio de pagamento, e não do Medusa — o
            porquê está no bloco do `brand.css` que cuida desta parte do card.
          */}
          {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
        </div>
      </div>
    </LocalizedClientLink>
  )
}
