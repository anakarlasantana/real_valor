/**
 * Os slides da capa — a lista que o carrossel desenha (e a capa estática de um
 * só).
 * -------------------------------------------------------------------------
 * A regra é uma só: **a capa é a lista `slides` da seção**, na ordem em que o
 * lojista a escreveu no CRM. Um item é a capa estática — a foto e a cópia dele,
 * e nenhum controle; dois ou mais viram carrossel
 * (`modules/home/components/hero/carousel.tsx`).
 *
 * Lista vazia é o caso **sem capa**: até a v9 valiam também os campos da própria
 * seção (`eyebrow`, `headline`, `imageUrl`…), e era essa a segunda forma que
 * saiu do contrato — dois jeitos de escrever a mesma capa no formulário
 * confundiam mais do que ajudavam, porque o campo de reserva continuava na tela
 * (e a loja continuava desenhando o slide) depois de o carrossel entrar no ar.
 *
 * Slide **vazio** (sem título e sem foto) cai fora: é o rastro de uma linha
 * recém-criada no editor do CRM, e uma tela preta no meio do carrossel é pior
 * do que a linha não existir. Sobrando um slide só depois do filtro, o
 * componente desenha a capa simples — carrossel de um slide é uma capa com
 * controles que não fazem nada.
 *
 * O tipo é **estrutural** (e não `HeroSection`) pelo mesmo motivo de
 * `lib/util/ticker.ts`: a decisão é testável com um objeto de dez linhas, sem
 * contrato gerado e sem render.
 */

/** Uma capa, já normalizada: todo campo é texto (possivelmente vazio). */
export type HeroSlide = {
  imageUrl: string
  imageAlt: string
  eyebrow: string
  headline: string
  headlineEmphasis: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

/** De onde os slides saem — a seção `hero`, como ela chega do CMS. */
export type HeroSlideSource = {
  slides?: unknown
}

/** Texto de verdade: o que não for string vira string vazia. */
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

/**
 * Um slide tem conteúdo quando tem **título ou foto**.
 *
 * Só o botão, ou só o subtítulo, não é um slide: é uma linha a meio preencher.
 * Um slide com título e sem foto é válido (capa tipográfica sobre o cacau da
 * seção), e um slide só com foto também (a foto fala sozinha).
 */
const hasContent = (slide: HeroSlide): boolean =>
  Boolean(slide.headline || slide.imageUrl)

/** Os slides da capa, na ordem da lista — sem os itens vazios. */
export function heroSlides(section: HeroSlideSource): HeroSlide[] {
  return Array.isArray(section.slides)
    ? section.slides.map(toSlide).filter(hasContent)
    : []
}

/** Um item da lista como slide de campos de texto. */
function toSlide(source: unknown): HeroSlide {
  const slide = (source ?? {}) as Partial<Record<keyof HeroSlide, unknown>>

  return {
    imageUrl: text(slide.imageUrl),
    imageAlt: text(slide.imageAlt),
    eyebrow: text(slide.eyebrow),
    headline: text(slide.headline),
    headlineEmphasis: text(slide.headlineEmphasis),
    subtitle: text(slide.subtitle),
    ctaLabel: text(slide.ctaLabel),
    ctaHref: text(slide.ctaHref),
  }
}
