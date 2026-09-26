import { type CollectionsSection } from "@lib/content/home-sections"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Collections — three tall editorial cards ("Nossas coleções").
 *
 * The prototype hard-coded the three names. Here they are data, so the
 * CMS can retitle, reorder or re-image them later.
 */
export default function CollectionHighlights({
  section,
}: {
  section: CollectionsSection
}) {
  if (!section.items?.length) {
    return null
  }

  return (
    <section className="w-full py-16 small:py-24">
      <div className="rv-container">
        <header className="mb-10 max-w-[620px] small:mb-14">
          {section.eyebrow && (
            <p className="rv-eyebrow mb-4 text-rv-rose">{section.eyebrow}</p>
          )}
          <h2 className="rv-display text-[28px] leading-tight small:text-[40px]">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="mt-4 text-base leading-relaxed text-rv-muted">
              {section.subtitle}
            </p>
          )}
        </header>

        <ul className="grid grid-cols-1 gap-6 small:grid-cols-3">
          {section.items.map((item) => (
            <li key={item.title} className="group">
              <LocalizedClientLink
                href={item.href}
                className="block focus:outline-none"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-rv-dourado/20">
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-rv-preto/70 via-rv-preto/10 to-transparent"
                  />

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="rv-display text-2xl text-rv-offwhite">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="mt-1 text-small-regular text-rv-offwhite/80">
                        {item.subtitle}
                      </p>
                    )}
                    <span className="rv-eyebrow mt-4 inline-block border-b border-rv-dourado pb-1 text-rv-dourado">
                      {item.ctaLabel}
                    </span>
                  </div>
                </div>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
