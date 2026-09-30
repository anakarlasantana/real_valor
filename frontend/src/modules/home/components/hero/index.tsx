import { type HeroSection } from "@lib/content/home-sections"
import { heroSlides, type HeroSlide } from "@lib/util/hero"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

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
 * o texto branco mantém contraste. A força vem do `overlay` do conteúdo, e o
 * tom é um cacau translúcido para a capa ficar dentro da paleta da marca em vez
 * de preto puro.
 *
 * A foto passa por `resolveMediaUrl`, então a imagem enviada pelo CRM (chave
 * crua do provider) e a URL absoluta do backend chegam as duas ao
 * `/uploads/...` do próprio storefront — a única forma que o otimizador de
 * imagem consegue buscar de dentro do contêiner. Ver `lib/util/media.ts`.
 *
 * **Com dois slides ou mais, a capa vira carrossel** — e sem JavaScript
 * nenhum. O trilho é um `flex` com encaixe (`scroll-snap`) e rolagem
 * horizontal: no celular é o gesto de arrastar de sempre, no desktop são os
 * pontos. Cada ponto é um `<a href="#hero-slide-N">`, o que dá a navegação por
 * teclado de graça, e o `scroll-behavior: smooth` faz a transição — desligada
 * em `prefers-reduced-motion` (ver `brand.css`).
 *
 * O que este desenho **não** tem, de propósito:
 *
 *   - **autoplay.** Trocar de foto sozinho é movimento que a WCAG 2.2.2 obriga
 *     a poder parar, e um botão de pausa sobre a capa é ruído que a loja não
 *     pediu. Quem rola é o visitante;
 *   - **setas.** Uma seta "próximo" precisa saber em que slide está para não
 *     mentir, e sem estado ela mentiria (a partir do último, "próximo" não
 *     existe). Os pontos não mentem: cada um leva a um slide nomeado;
 *   - **ponto aceso.** Marcar o slide atual pede a posição da rolagem, que é
 *     leitura de cliente — e o carrossel inteiro é servidor, o que é o que faz
 *     a capa ser a primeira pintura da home. O caminho é um
 *     `IntersectionObserver` sobre os slides, e é uma troca consciente: ponto
 *     aceso por hidratação da capa.
 */
export default function Hero({ section }: { section: HeroSection }) {
  const overlay = Math.min(Math.max(section.overlay ?? 0.72, 0), 1)
  const slides = heroSlides(section)

  if (slides.length === 0) {
    return null
  }

  return (
    <section className="relative w-full overflow-hidden bg-rv-cacao">
      {slides.length > 1 ? (
        <>
          <div className="rv-hero-track no-scrollbar flex snap-x snap-mandatory scroll-smooth overflow-x-auto">
            {slides.map((slide, index) => (
              <div
                key={`${index}:${slide.headline}`}
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
          </div>
          <HeroDots count={slides.length} />
        </>
      ) : (
        <HeroPane slide={slides[0]} overlay={overlay} priority />
      )}
    </section>
  )
}

/** O `id` da âncora de um slide — o destino dos pontos e nada mais. */
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

/**
 * Os pontos: um `<a href="#hero-slide-N">` por slide.
 *
 * Ficam no canto inferior esquerdo, **sobre a área escura do véu** — é o único
 * lugar da capa em que uma bolinha off white fica visível sobre qualquer foto,
 * e é também onde a cópia já está: o olho que lê o título encontra a navegação
 * no caminho, sem uma segunda faixa de controles por cima da fotografia.
 */
function HeroDots({ count }: { count: number }) {
  return (
    <ul className="rv-container absolute inset-x-0 bottom-8 z-20 flex items-center gap-x-3">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <a
            href={`#${heroSlideId(index)}`}
            aria-label={`Ir para o slide ${index + 1} de ${count}`}
            className="rv-hero-dot"
          />
        </li>
      ))}
    </ul>
  )
}

