import { type EditorialSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * O manifesto (a seção `editorial`) — a frase manuscrita e a foto **ao lado**
 * do texto da marca.
 *
 * É o par oposto do `EditorialCallout` logo abaixo na página: lá a foto é o
 * fundo da faixa; aqui ela é uma coluna, e a cópia mora na outra. É essa a
 * diferença que o contrato separa em dois tipos (`editorial` e `banner`), e não
 * uma variação de desenho.
 *
 * `imagePosition` (campo do CMS) diz de que lado a fotografia entra, e por isso
 * a **ordem das colunas** é decidida aqui: é estrutura, não desenho. A grade, o
 * degrau de uma coluna e os tamanhos da cópia são da régua — a família
 * `.rv-manifesto-*` do `brand.css`. Como no `EditorialCallout`, os números
 * estavam no `className` (`aspect-[4/5]`, `text-[34px]`, `gap-10`,
 * `grid-cols-2`) e o `brand.css` não tinha um `rv-manifesto`: era a "segunda
 * régua" que o `ruler.spec.ts` prende, e o teste novo de lá cobre esta seção.
 *
 * A foto passa por `resolveMediaUrl` (ver `lib/util/media.ts`): a imagem enviada
 * pelo CRM chega como chave do provider e é traduzida aqui, como no hero, na
 * capa e na faixa editorial. O fundo da caixa é o dourado a 20% (em `color-mix`,
 * para compor sobre o fundo que o lojista escolheu para a seção).
 */
export default function EditorialBanner({
  section,
}: {
  section: EditorialSection
}) {
  const imageFirst = section.imagePosition === "left"
  const image = resolveMediaUrl(section.imageUrl)

  const media = (
    <div className="rv-manifesto-media">
      {image && (
        <Image
          src={image}
          alt={section.imageAlt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="rv-manifesto-photo"
        />
      )}
    </div>
  )

  const copy = (
    <div className="rv-manifesto-copy">
      {section.eyebrow && (
        <p className="rv-eyebrow rv-section-accent rv-manifesto-eyebrow">
          {section.eyebrow}
        </p>
      )}

      {section.script && (
        <p className="rv-script rv-section-accent rv-manifesto-script">
          {section.script}
        </p>
      )}

      <h2 className="rv-display rv-section-heading rv-manifesto-title">
        {section.title}
        {section.titleEmphasis && (
          <>
            <br />
            <em>{section.titleEmphasis}</em>
          </>
        )}
      </h2>

      {section.body && (
        <p className="rv-section-text rv-manifesto-body">{section.body}</p>
      )}

      {section.ctaLabel && (
        <LocalizedClientLink
          href={section.ctaHref}
          className="rv-eyebrow rv-manifesto-cta"
        >
          {section.ctaLabel}
        </LocalizedClientLink>
      )}
    </div>
  )

  return (
    <section className="rv-section-bg-surface rv-section-pad w-full">
      <div className="rv-container">
        <div className="rv-manifesto-grid">
          {imageFirst ? (
            <>
              {media}
              {copy}
            </>
          ) : (
            <>
              {copy}
              {media}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
