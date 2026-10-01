import { type HeroSection } from "@lib/content/home-sections"
import { heroSlides, type HeroSlide } from "@lib/util/hero"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

import HeroCarousel from "./carousel"

/**
 * Hero — a capa: fotografia full-bleed com a cópia ancorada à esquerda, sobre
 * um véu escuro horizontal.
 *
 * Substituiu o antigo split 50/50 (painel cacau + imagem, com os selos de
 * confiança dentro), que não era o do protótipo — os selos hoje são a seção
 * `benefits-bar`.
 *
 * O véu é o gradiente da esquerda para a direita: escuro atrás da cópia e
 * quase transparente em 75% da largura, então a foto continua visível enquanto
 * o texto branco mantém contraste. A força é a constante `SCRIM` abaixo — o tom
 * é um cacau translúcido para a capa ficar dentro da paleta da marca em vez de
 * preto puro.
 *
 * Era um campo do conteúdo (`overlay`, "Scrim (0 a 1)") até a v9, quando a capa
 * ficou só com a lista de slides: a força do véu é valor de **desenho**, e não
 * conteúdo que o lojista escreve — um nono campo no formulário da capa para um
 * ajuste que ninguém pede. O valor é o que estava no ar quando o campo saiu.
 *
 * A foto passa por `resolveMediaUrl`, então a imagem enviada pelo CRM (chave
 * crua do provider) e a URL absoluta do backend chegam as duas ao
 * `/uploads/...` do próprio storefront — a única forma que o otimizador de
 * imagem consegue buscar de dentro do contêiner. Ver `lib/util/media.ts`.
 *
 * **Com dois slides ou mais, a capa vira carrossel** — e o carrossel é uma
 * ilha de cliente (`./carousel.tsx`): o rodízio precisa de relógio e o ponto
 * aceso precisa da posição da rolagem, e as duas coisas só existem no
 * navegador. As fotos e as cópias continuam vindo do **servidor**: os slides
 * atravessam a fronteira como `children`, então a primeira pintura da home
 * segue sendo a capa com a cópia no HTML — o que hidrata é o controle, não a
 * imagem.
 *
 * A ilha acrescenta o que faltava na capa:
 *
 *   - **o rodízio**, sete segundos por slide (`lib/util/hero-carousel.ts`), com
 *     a contagem reiniciada a cada troca — inclusive na que o visitante fez à
 *     mão;
 *   - **o ponto aceso**, lido da posição do trilho uma vez por quadro: é por
 *     isso que arrastar com o dedo acende o ponto certo;
 *   - **o botão de pausa**, que é o que a WCAG 2.2.2 pede de um movimento
 *     automático — e que o `:hover` sozinho não atendia (quem pausa no ponteiro
 *     precisa estar com o ponteiro em cima). O rodízio também não anda em
 *     `prefers-reduced-motion`, nem com a aba oculta, nem com o foco do teclado
 *     dentro da capa.
 *
 * Uma coisa continua de fora, e de propósito: **setas.** O ponto leva a
 * qualquer slide e diz onde a capa está; uma seta "próximo" seria um segundo
 * controle para a mesma decisão — e, a partir do último slide, uma seta que não
 * tem para onde ir.
 *
 * Com **um slide só** — a capa estática — não há rodízio a fazer: a seção
 * desenha a foto e a cópia e não monta JavaScript nenhum. Sem slide nenhum a
 * capa não existe: a seção some da página em vez de virar uma faixa vazia.
 */

/**
 * A força do véu escuro da capa, de 0 (foto limpa) a 1 (cacau sólido).
 *
 * Constante do render desde a v9 — era o campo `overlay` do conteúdo. 0.75 é o
 * valor que estava gravado quando o campo saiu do formulário; o protótipo usa
 * .72 caindo para .02 em 75% da largura (o gradiente abaixo).
 */
const SCRIM = 0.75

export default function Hero({ section }: { section: HeroSection }) {
  const overlay = SCRIM
  const slides = heroSlides(section)

  if (slides.length === 0) {
    return null
  }

  return (
    <section className="relative w-full overflow-hidden bg-rv-cacao">
      {slides.length > 1 ? (
        <HeroCarousel count={slides.length}>
          {slides.map((slide, index) => (
            <div
              key={`${index}:${slide.headline}`}
              // O `id` fica no slide, e não no ponto: é ele que faz
              // `#hero-slide-2` continuar sendo um endereço da capa.
              id={heroSlideId(index)}
              className="w-full min-w-full flex-none snap-start"
            >
              <HeroPane
                slide={slide}
                overlay={overlay}
                // Só a primeira foto tem pressa: as outras estão fora da tela
                // e o `next/image` as busca quando o carrossel chegar nelas.
                priority={index === 0}
              />
            </div>
          ))}
        </HeroCarousel>
      ) : (
        <HeroPane slide={slides[0]} overlay={overlay} priority />
      )}
    </section>
  )
}

/** O `id` da âncora de um slide — o endereço de `#hero-slide-N`. */
function heroSlideId(index: number): string {
  return `hero-slide-${index + 1}`
}

/**
 * Uma capa: a foto, o véu e a cópia. É o mesmo bloco para a capa única e para
 * cada slide do carrossel — o que muda entre os dois casos é quem o envolve, e
 * é por isso que ele é um componente e não um trecho copiado duas vezes.
 */
function HeroPane({
  slide,
  overlay,
  priority = false,
}: {
  slide: HeroSlide
  overlay: number
  priority?: boolean
}) {
  const midOverlay = Number((overlay * 0.62).toFixed(3))
  const image = resolveMediaUrl(slide.imageUrl)

  return (
    <div className="relative flex min-h-[560px] items-center small:min-h-[580px]">
      {image && (
        <Image
          src={image}
          alt={slide.imageAlt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover object-center"
        />
      )}

      {/* Scrim: cacao fading to transparent across the width. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, rgba(27,15,12,${overlay}) 0%, rgba(27,15,12,${midOverlay}) 35%, rgba(27,15,12,0.02) 75%)`,
        }}
      />

      <div className="relative z-10 w-full">
        <div className="rv-container">
          <div className="rv-section-pad max-w-[620px]">
            {slide.eyebrow && (
              <p className="rv-eyebrow rv-section-text-inherit mb-5">
                {slide.eyebrow}
              </p>
            )}

            <h1 className="rv-display rv-section-heading-onmedia text-[38px] leading-[1.08] small:text-[54px] xlarge:text-[68px]">
              {slide.headline}{" "}
              {slide.headlineEmphasis && (
                <em className="rv-section-accent-onmedia italic">
                  {slide.headlineEmphasis}
                </em>
              )}
            </h1>

            {slide.subtitle && (
              <p className="rv-section-text-inherit mt-6 max-w-[440px] text-base leading-relaxed">
                {slide.subtitle}
              </p>
            )}

            {slide.ctaLabel && (
              <LocalizedClientLink
                href={slide.ctaHref}
                className="rv-eyebrow rv-section-accent-fill mt-9 inline-flex items-center justify-center rounded-[var(--rv-radius)] px-8 py-4 transition-colors duration-200 ease-in hover:bg-rv-rose-strong"
                data-testid="hero-cta"
              >
                {slide.ctaLabel}
              </LocalizedClientLink>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

