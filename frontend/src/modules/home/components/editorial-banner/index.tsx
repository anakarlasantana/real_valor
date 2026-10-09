import { type EditorialSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Editorial banner ("Vista o seu valor.") — script line + photo side by
 * side with the brand story copy.
 *
 * `imagePosition` controls which column the photograph occupies, so the
 * rhythm can be flipped from the CMS without a code change.
 *
 * The photo goes through `resolveMediaUrl` (see `lib/util/media.ts`) so an
 * upload from the CRM works here exactly as it does in the hero.
 */
export default function EditorialBanner({
  section,
}: {
  section: EditorialSection
}) {
  const imageFirst = section.imagePosition === "left"
  const image = resolveMediaUrl(section.imageUrl)

  const media = (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-rv-dourado/20 small:aspect-[5/6]">
      {image && (
        <Image
          src={image}
          alt={section.imageAlt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
        />
      )}
    </div>
  )

  const copy = (
    <div className="flex flex-col justify-center">
      {section.eyebrow && (
        <p className="rv-eyebrow rv-section-accent mb-4">{section.eyebrow}</p>
      )}

      {section.script && (
        <p className="rv-script rv-section-accent text-[34px] leading-none small:text-[44px]">
          {section.script}
        </p>
      )}

      <h2 className="rv-display rv-section-heading mt-5 text-[26px] leading-tight small:text-[36px]">
        {section.title}
        {section.titleEmphasis && (
          <>
            <br />
            <em className="italic">{section.titleEmphasis}</em>
          </>
        )}
      </h2>

      {section.body && (
        <p className="rv-section-text mt-5 max-w-[460px] text-base leading-relaxed">
          {section.body}
        </p>
      )}

      {section.ctaLabel && (
        <LocalizedClientLink
          href={section.ctaHref}
          className="rv-eyebrow mt-8 inline-flex w-fit items-center justify-center border border-rv-grafite px-7 py-3 text-rv-grafite transition-colors duration-200 ease-in hover:bg-rv-grafite hover:text-rv-offwhite"
        >
          {section.ctaLabel}
        </LocalizedClientLink>
      )}
    </div>
  )

  return (
    <section className="rv-section-bg-surface rv-section-pad w-full">
      <div className="rv-container">
        <div className="grid grid-cols-1 items-center gap-10 small:grid-cols-2 small:gap-16">
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
