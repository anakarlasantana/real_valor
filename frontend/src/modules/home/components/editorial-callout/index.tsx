import { type BannerSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

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
 * O véu é a constante `VEIL`, e não um campo do CRM: como o `SCRIM` da capa, a
 * força do gradiente é valor de **desenho** — o lojista escolhe a foto e o
 * texto, não a opacidade do véu. O tom é o do protótipo (grafite a 75% na
 * esquerda, dissolvendo antes de 70% da largura) para a foto continuar visível
 * onde não há texto.
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
    <section className="relative flex min-h-[520px] items-center overflow-hidden bg-rv-cacao small:min-h-[600px]">
      {image && (
        <Image
          src={image}
          alt={section.imageAlt}
          fill
          sizes="100vw"
          className="object-cover object-[center_28%] opacity-60"
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: VEIL }}
      />

      <div className="relative z-10 w-full">
        <div className="rv-container">
          <div className="rv-section-pad max-w-[880px]">
            {section.eyebrow && (
              <p className="rv-eyebrow rv-section-accent-onmedia mb-4">
                {section.eyebrow}
              </p>
            )}

            <h2 className="rv-display rv-section-heading-onmedia text-[44px] leading-[0.96] small:text-[72px]">
              {section.title}
              {section.titleEmphasis && (
                <>
                  <br />
                  <em className="italic">{section.titleEmphasis}</em>
                </>
              )}
            </h2>

            {section.ctaLabel && (
              <LocalizedClientLink
                href={section.ctaHref}
                className="rv-eyebrow mt-9 inline-flex items-center justify-center border border-rv-offwhite px-8 py-4 text-rv-offwhite transition-colors duration-200 ease-in hover:bg-rv-offwhite hover:text-rv-cacao"
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
