import { resolveIcon } from "@lib/content/icons"
import { type BenefitsSection } from "@lib/content/home-sections"

/**
 * Benefits bar — four reassurance items right under the hero.
 *
 * 4 columns on desktop, 2×2 on mobile, separated by hairline dividers
 * as in the prototype. Icons are resolved from a string key so the CMS
 * can drive them without shipping code (see `lib/content/icons.ts`).
 */
export default function BenefitsBar({
  items,
}: {
  items: BenefitsSection["items"]
}) {
  if (!items?.length) {
    return null
  }

  return (
    <section
      aria-label="Vantagens"
      className="w-full border-b border-rv-border bg-rv-surface"
    >
      <div className="rv-container">
        <ul className="grid grid-cols-2 divide-x divide-y divide-rv-border small:grid-cols-4 small:divide-y-0">
          {items.map((item, index) => {
            const Icon = resolveIcon(item.icon)

            return (
              <li
                key={`${item.title}-${index}`}
                className="flex flex-col items-center gap-2 px-4 py-6 text-center small:py-8"
              >
                <Icon
                  className="h-5 w-5 text-rv-rose"
                  aria-hidden="true"
                  focusable="false"
                />
                <p className="text-small-semi uppercase tracking-[0.12em] text-rv-grafite">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xsmall-regular text-rv-muted">
                    {item.subtitle}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
