import { type LaunchesSection } from "@lib/content/home-sections"
import { listProducts } from "@lib/data/products"
import { launchesLimit } from "@lib/util/launches"
import { revealDelay } from "@lib/util/motion"
import ArrowIcon from "@modules/common/components/arrow-icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Reveal from "@modules/common/components/reveal"
import ProductPreview from "@modules/products/components/product-preview"
import ProductCarousel from "../product-carousel"
import { HttpTypes } from "@medusajs/types"

/**
 * Lançamentos — o trilho de novidades logo depois do hero.
 *
 * A seção carrega só a cópia; **os produtos vêm da loja**, do mais novo para o
 * mais antigo. É o que faz o trilho se manter sozinho: publicar uma peça no
 * painel já a coloca aqui, sem ninguém editar bloco. Quem escolhe *quais* peças
 * (curadoria) é o próximo passo — `kind: "products"` no contrato.
 *
 * Duas decisões de layout, e o motivo de cada uma:
 *
 * 1. **Trilho, não grade.** O bloco responde "o que chegou?", e a resposta é uma
 *    sequência, não um quadro: o trilho rola na horizontal, cada card para no
 *    lugar certo (`snap-x`, em `.rv-carousel-track`) e o trilho **atravessa a
 *    tela** — a seção é quem hospeda a sangria (`rv-bleed`), então o próximo
 *    card é cortado pela borda em vez de terminar antes dela. A grade fica no
 *    catálogo (`/store`), e "Peças em destaque" — que era grade de quatro
 *    colunas — virou o mesmo carrossel, logo acima.
 * 2. **O mesmo carrossel da outra seção, e não um parecido.** Largura de card,
 *    setas, pontos, rodízio e o holofote do ponteiro vêm todos de
 *    `product-carousel/index.tsx`: eram duas ilhas para a mesma decisão, e duas
 *    cópias divergiriam no primeiro ajuste feito em uma só. O que continua sendo
 *    **desta seção** é a ordem (as novidades, por `-created_at`) e a faixa
 *    estreita (`rv-section-pad-tight`, 5rem de respiro contra 6rem): a vitrine é
 *    a mesma, e os lançamentos chegam mais cedo na página.
 * 3. **Com uma peça só, sem carrossel.** Com duas ou mais, a seção monta a ilha
 *    (é ela quem mede a tela e decide se há página para trocar); com uma, a lista
 *    é desenhada parada — não há página nenhuma em tela nenhuma.
 *
 * 4. **O cabeçalho é a linha da régua** (`.rv-section-head` e a família
 *    `rv-section-*`, em `brand.css`): o título à esquerda e o "Ver tudo" à
 *    direita, os dois alinhados pela base, o título em
 *    `clamp(2rem, 3.5vw, 3.25rem)` e o link como texto herdado, de fio preto.
 *    Era um utilitário atrás do outro no `className` (28px/40px,
 *    `mb-8 small:mb-10`, 620px de largura) — e a régua é uma só, a mesma que
 *    "Peças em destaque" usa logo abaixo na página.
 *
 * `limit` passa por `launchesLimit`: a faixa é do contrato e a API já a
 * confere, mas o que está gravado pode ser anterior à faixa (ver
 * `lib/util/launches.ts`).
 */
export default async function LaunchesRail({
  section,
  region,
}: {
  section: LaunchesSection
  region: HttpTypes.StoreRegion
}) {
  const limit = launchesLimit(section.limit)

  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit,
      // "-created_at" é o "acabou de chegar" do banco, e não uma escolha de
      // ninguém: quem publica não precisa lembrar de incluir a peça no trilho.
      order: "-created_at",
      /*
       * **Sem `fields` próprio, e isso é a correção de um defeito silencioso.**
       * A chamada pedia uma lista reduzida ("preço, imagem, metadata, tags") e um
       * `fields` explícito **substitui** o da consulta (`products.ts`): sem
       * estoque, o vestido com 50 unidades era lido como esgotado ("o estoque tem
       * a palavra final", `product-availability.ts`); sem o hex da variante, as
       * bolinhas de cor saíam como letras; e sem a categoria, o card ficava sem o
       * eyebrow. O trilho dizia outra coisa sobre a mesma peça que o catálogo
       * dizia — e é o próprio `data/product-fields.ts` que avisa que esse defeito
       * não aparece como erro. A guarda está em `product-enrichment.spec.ts`.
       */
    },
  })

  /*
   * Os cards, montados uma vez só: a mesma lista serve o carrossel e o trilho
   * parado (a loja com uma peça só). O `isFeatured` pede a proporção larga das
   * seções de vitrine (11/14) — ver `thumbnail/index.tsx`.
   */
  const cards = (products ?? []).map((product, index) => (
    <li key={product.id} className="rv-carousel-item">
      {/* A entrada em cena é escalonada pelo índice do card: a seção chega como
          uma coisa só, e não como cards soltos (ver `revealDelay`). */}
      <Reveal delay={revealDelay(index)}>
        <ProductPreview product={product} region={region} isFeatured />
      </Reveal>
    </li>
  ))

  /* Com uma peça só, nenhuma tela tem página para trocar (ver o item 3 acima). */
  const hasPages = (products?.length ?? 0) > 1

  return (
    <section className="rv-bleed rv-section-pad-tight w-full">
      <div className="rv-container">
        <header className="rv-section-head">
          <div>
            {section.eyebrow && (
              <p className="rv-eyebrow rv-section-eyebrow rv-section-accent">
                {section.eyebrow}
              </p>
            )}
            <h2 className="rv-display rv-section-heading rv-section-title">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="rv-section-text rv-section-subtitle">
                {section.subtitle}
              </p>
            )}
          </div>

          {section.viewAllLabel && (
            <LocalizedClientLink
              href={section.viewAllHref || "/store"}
              className="rv-section-link"
            >
              {section.viewAllLabel}{" "}
              <ArrowIcon className="rv-section-link-icon" />
            </LocalizedClientLink>
          )}
        </header>

        {!products?.length ? (
          <p className="rv-section-text py-10 text-base">
            Nenhuma peça publicada ainda. As novidades aparecem aqui conforme
            entrarem na loja.
          </p>
        ) : hasPages ? (
          /*
           * `label` é o que o leitor de tela ouve ao entrar no carrossel — o
           * mesmo título que a seção mostra na tela.
           */
          <ProductCarousel label={section.title} count={products.length}>
            {cards}
          </ProductCarousel>
        ) : (
          /*
           * Sem ilha: a lista parada. O `rv-rail` continua aqui pela barra de
           * rolagem (fina e dourada no desktop, ausente no celular) e as classes
           * de card são as mesmas do carrossel — a peça sozinha ocupa a mesma
           * largura que ocuparia no trilho.
           */
          <ul className="rv-carousel-track rv-rail">{cards}</ul>
        )}
      </div>
    </section>
  )
}
