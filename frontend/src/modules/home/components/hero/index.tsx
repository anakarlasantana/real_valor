import { type HeroSection } from "@lib/content/home-sections"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Hero — full-bleed editorial photograph with a left-anchored copy
 * block over a horizontal dark scrim.
 *
 * Replaces the previous 50/50 cacao-panel + image split (and its
 * inline trust badges, now their own `benefits-bar` section), which did
 * not match the prototype.
 *
 * The scrim is a left-to-right gradient — dark behind the copy, almost
 * transparent by 75% — so the photograph stays visible while white type
 * keeps its contrast. Its strength comes from `overlay` in the content,
 * and the tone is a translucent cacao so the hero stays inside the
 * brand palette instead of pure black.
 */
export default function Hero({ section }: { section: HeroSection }) {
  const overlay = Math.min(Math.max(section.overlay ?? 0.72, 0), 1)
  const midOverlay = Number((overlay * 0.62).toFixed(3))

  return (
    <section className="relative w-full overflow-hidden bg-rv-cacao">
      <div className="relative flex min-h-[560px] items-center small:min-h-[580px]">
        {section.imageUrl && (
          <Image
            src={section.imageUrl}
            alt={section.imageAlt}
            fill
            priority
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
            <div className="max-w-[620px] py-16 small:py-24">
              {section.eyebrow && (
                <p className="rv-eyebrow rv-section-text-inherit mb-5">
                  {section.eyebrow}
                </p>
              )}

              <h1 className="rv-display rv-section-heading-onmedia text-[38px] leading-[1.08] small:text-[54px] xlarge:text-[68px]">
                {section.headline}{" "}
                <em className="rv-section-accent-onmedia italic">
                  {section.headlineEmphasis}
                </em>
              </h1>

              {section.subtitle && (
                <p className="rv-section-text-inherit mt-6 max-w-[440px] text-base leading-relaxed">
                  {section.subtitle}
                </p>
              )}

              {section.ctaLabel && (
                <LocalizedClientLink
                  href={section.ctaHref}
                  className="rv-eyebrow rv-section-accent-fill mt-9 inline-flex items-center justify-center rounded-[var(--rv-radius)] px-8 py-4 transition-colors duration-200 ease-in hover:bg-rv-rose-strong"
                  data-testid="hero-cta"
                >
                  {section.ctaLabel}
                </LocalizedClientLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
