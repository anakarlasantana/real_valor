import { type HeroSection } from "@lib/content/home-sections"
import { heroSlides, type HeroSlide } from "@lib/util/hero"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { type CSSProperties } from "react"

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
 * quase transparente antes de 3/4 da largura, então a foto continua visível
 * enquanto o texto branco mantém contraste. A força é a constante `SCRIM` abaixo
 * — o tom é um cacau translúcido para a capa ficar dentro da paleta da marca em
 * vez de preto puro —, e o **desenho** do gradiente (onde cada degrau cai, e o
 * fato de ele deitar no celular, onde a cópia desce para o pé da foto) está em
 * `heroScrimVars` e em `brand.css`. A força é um número; a geometria é da régua.
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
 *   - **o rodízio**, sete segundos por slide (`hero/carousel.tsx`), com a
 *     contagem reiniciada a cada troca — inclusive na que o visitante fez à mão;
 *   - **o ponto aceso**, lido da posição do trilho uma vez por quadro: é por isso
 *     que arrastar com o dedo acende o ponto certo;
 *   - **a parada de vez no primeiro clique**, que é o que atende a WCAG 2.2.2 sem
 *     um botão de pausa: quem clica num ponto assume o volante, e o rodízio não
 *     volta. Junto com ele, o `prefers-reduced-motion` desliga o movimento por
 *     inteiro, e o ponteiro, o foco do teclado e a aba oculta seguram enquanto
 *     estão lá.
 *
 * Uma coisa continua de fora, e de propósito: **setas.** O ponto leva a qualquer
 * slide e diz onde a capa está; uma seta "próximo" seria um segundo controle para
 * a mesma decisão — e, a partir do último slide, uma seta que não tem para onde
 * ir. O carrossel de produtos, que é o mesmo componente de trilho, tem as duas
 * coisas: lá as páginas são cards, e a seta é o gesto de "ver as próximas peças"
 * que o dedo já conhece.
 *
 * Com **um slide só** — a capa estática — não há rodízio a fazer: a seção
 * desenha a foto e a cópia e não monta JavaScript nenhum. Sem slide nenhum a
 * capa não existe: a seção some da página em vez de virar uma faixa vazia.
 */

/**
 * A força do véu escuro da capa, de 0 (foto limpa) a 1 (cacau sólido).
 *
 * Constante do render desde a v9 — era o campo `overlay` do conteúdo. 0.75 é o
 * valor que estava gravado quando o campo saiu do formulário, e é o **único**
 * número desta decisão: os degraus dos dois gradientes saem dele (ver
 * `heroScrimVars`).
 *
 * São **dois** véus, e não um, porque a régua deita o gradiente quando a cópia
 * muda de lugar: deitado no desktop (escuro na esquerda, onde o texto está, e
 * dissolvendo antes de 3/4 da largura) e **em pé** no celular, onde a cópia passa
 * a morar no pé da foto. Os dois saem daqui como variáveis CSS e quem escolhe
 * qual vale é a media query do `.rv-hero-scrim` em `brand.css`.
 */
const SCRIM = 0.75

/**
 * Os dois véus da capa, para o `style` do elemento.
 *
 * A régua escreve três pontos em cada um (`rgba(23,18,17,.76) → .35 em 48% →
 * .04 em 72%`, e `.78 → .04 em 80%` no celular). O que chega aqui é o **mesmo
 * desenho**, com o número da casa no lugar do dela: o meio a 46% da força (o .35
 * da régua é 46% do .76 dela) e o pé do véu em pé três centésimos acima do topo
 * do deitado (a régua: .78 contra .76) — porque lá embaixo o texto fica sobre a
 * foto, sem o lado claro para escapar.
 */
function heroScrimVars(overlay: number): CSSProperties {
  const mid = Number((overlay * 0.46).toFixed(3))
  const foot = Number(Math.min(1, overlay + 0.03).toFixed(3))

  return {
    "--rv-hero-scrim-x": `linear-gradient(90deg, rgba(23,18,17,${overlay}) 0%, rgba(23,18,17,${mid}) 48%, rgba(23,18,17,0.02) 72%)`,
    "--rv-hero-scrim-y": `linear-gradient(0deg, rgba(23,18,17,${foot}) 0%, rgba(23,18,17,0.04) 80%)`,
  } as CSSProperties
}

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

      {/*
        A nota da capa: o recado do canto inferior direito, em itálico — o
        mesmo lugar e o mesmo tom do protótipo. Fica **fora** do carrossel de
        propósito: é da faixa, não do slide, então não rola junto com a foto.
        Abaixo do ponto de quebra ela não é desenhada (o canto é onde a cópia
        do slide termina no celular).
      */}
      {section.note && <p className="rv-display rv-hero-note">{section.note}</p>}
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
 *
 * **O desenho da capa mora em `brand.css`** (`.rv-hero` e a família `rv-hero-*`),
 * e não em utilitários aqui: a régua da capa é uma só — altura, véu, enquadramento
 * da foto, posição da cópia e tamanho do título —, e a media query do celular
 * precisa virar três das cinco de uma vez (a cópia desce, o véu deita, o
 * enquadramento muda). Em utilitário isso seria um `small:` atrás do outro no
 * mesmo `className`, que é como o desenho fica impossível de ler.
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
  const image = resolveMediaUrl(slide.imageUrl)

  return (
    <div className="rv-hero">
      {image && (
        <Image
          src={image}
          alt={slide.imageAlt}
          fill
          priority={priority}
          sizes="100vw"
          className="rv-hero-photo object-cover"
        />
      )}

      {/* Os dois véus (deitado e em pé) chegam em variáveis: quem escolhe qual
          vale é a media query, em `.rv-hero-scrim` — ver `heroScrimVars`. */}
      <div
        aria-hidden="true"
        className="rv-hero-scrim"
        style={heroScrimVars(overlay)}
      />

      <div className="rv-hero-copy">
        {slide.eyebrow && (
          <p className="rv-eyebrow rv-hero-eyebrow">{slide.eyebrow}</p>
        )}

        <h1 className="rv-display rv-hero-title">
          {slide.headline}{" "}
          {slide.headlineEmphasis && <em>{slide.headlineEmphasis}</em>}
        </h1>

        {slide.subtitle && <p className="rv-hero-lede">{slide.subtitle}</p>}

        {slide.ctaLabel && (
          <LocalizedClientLink
            href={slide.ctaHref}
            className="rv-eyebrow rv-section-accent-fill rv-hero-cta inline-flex items-center justify-center"
            data-testid="hero-cta"
          >
            {slide.ctaLabel}
          </LocalizedClientLink>
        )}
      </div>
    </div>
  )
}

