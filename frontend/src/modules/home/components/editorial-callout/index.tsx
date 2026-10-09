import { type BannerSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { type CSSProperties } from "react"

/**
 * A faixa editorial (o tipo `banner`): a foto inteira, o véu, o eyebrow, o
 * título em duas linhas e o botão que leva ao catálogo.
 *
 * É a última faixa do protótipo redesenhado, e não se confunde com o
 * `EditorialBanner` ao lado — aquele desenha a seção `editorial` (o manifesto,
 * com a foto **ao lado** do texto, a frase manuscrita e o texto corrido da
 * marca). Aqui a foto **é** o fundo da faixa, como no hero: a cópia fica sobre
 * ela, e é por isso que o título e o eyebrow usam as classes `-onmedia` (o
 * off white e o dourado que a loja já usa sobre fotografia).
 *
 * **O desenho mora em `brand.css`** (a família `.rv-callout-*`), e não em
 * utilitários aqui. Era o defeito que o `ruler.spec.ts` descreve como "a
 * segunda régua": os tamanhos da faixa (`min-h-[520px] text-[44px]
 * small:text-[72px]`) estavam no `className`, o `brand.css` não tinha um
 * `rv-callout` — e um utilitário do Tailwind, emitido **depois** do `brand.css`,
 * venceria qualquer ajuste feito por lá. Agora o componente escreve a classe e
 * a régua é uma só; o teste novo de `home/components/ruler.spec.ts` prende isso.
 *
 * O véu é a constante `VEIL`, e não um campo do CRM: como o `SCRIM` da capa, a
 * força do gradiente é valor de **desenho** — o lojista escolhe a foto e o
 * texto, não a opacidade do véu. O tom é o do protótipo (grafite a 75% na
 * esquerda, dissolvendo antes de 70% da largura) para a foto continuar visível
 * onde não há texto. Ela chega inline, em `--rv-callout-veil`, e a classe
 * `.rv-callout-veil` só a aplica — mesma arquitetura dos dois véus da capa.
 *
 * A foto passa por `resolveMediaUrl` (ver `lib/util/media.ts`): a imagem
 * enviada pelo CRM chega como chave do provider e é traduzida aqui, como no
 * hero e no manifesto. Sem imagem não há faixa (o campo é obrigatório na API),
 * então a seção desenha o fundo cacau em vez de um buraco.
 */
const VEIL = "linear-gradient(90deg, rgba(23,23,23,0.75), transparent 70%)"

export default function EditorialCallout({
  section,
}: {
  section: BannerSection
}) {
  const image = resolveMediaUrl(section.imageUrl)

  return (
    <section
      className="rv-callout"
      style={{ "--rv-callout-veil": VEIL } as CSSProperties}
    >
      {image && (
        <Image
          src={image}
          alt={section.imageAlt}
          fill
          sizes="100vw"
          className="rv-callout-photo"
        />
      )}

      <div aria-hidden="true" className="rv-callout-veil" />

      <div className="rv-callout-body">
        <div className="rv-container">
          <div className="rv-section-pad rv-callout-copy">
            {section.eyebrow && (
              <p className="rv-eyebrow rv-section-accent-onmedia rv-callout-eyebrow">
                {section.eyebrow}
              </p>
            )}

            <h2 className="rv-display rv-section-heading-onmedia rv-callout-title">
              {section.title}
              {section.titleEmphasis && (
                <>
                  <br />
                  <em>{section.titleEmphasis}</em>
                </>
              )}
            </h2>

            {section.ctaLabel && (
              <LocalizedClientLink
                href={section.ctaHref}
                className="rv-eyebrow rv-callout-cta"
                data-testid="banner-cta"
              >
                {section.ctaLabel}
              </LocalizedClientLink>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
