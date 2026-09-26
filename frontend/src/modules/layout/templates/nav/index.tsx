import { Suspense } from "react"

import { type NavSection } from "@lib/content/home-sections"
import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import NavLink from "@modules/layout/components/nav-link"
import SideMenu from "@modules/layout/components/side-menu"

/**
 * Main navigation — matches the prototype: logo left, links centred,
 * actions right on a `1fr auto 1fr` grid.
 *
 * The menu is content, not code: labels, destinations, order and
 * visibility come from the `nav` block of the CMS (edited at Admin →
 * Conteúdo da vitrine). The header travels in the same payload as the
 * home, so `layout.tsx` resolves it once with `headerSections()` and
 * passes it down — and this component stays a pure renderer.
 *
 * The bag action is the exception: it is the only one with state, so it
 * delegates to `CartButton`.
 */
export default async function Nav({ header }: { header: NavSection }) {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-20 border-b bg-rv-offwhite border-rv-border">
        <nav className="rv-container grid h-full grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Left — wordmark on desktop, drawer trigger on mobile. */}
          <div className="flex h-full items-center gap-4">
            <div className="h-full small:hidden">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                header={header}
              />
            </div>

            {/* Wordmark — replaced once the official vector logo is available */}
            <LocalizedClientLink
              href="/"
              className="flex flex-col leading-none"
              data-testid="nav-store-link"
              aria-label="Real Valor — página inicial"
            >
              <span className="rv-display text-lg tracking-[0.28em] text-rv-preto small:text-2xl">
                REAL VALOR
              </span>
              <span className="rv-eyebrow mt-1 hidden text-rv-rose small:block">
                Alfaiataria feminina
              </span>
            </LocalizedClientLink>
          </div>

          {/* Centre — primary links, straight from the CMS. */}
          {header.links.length > 0 && (
            <ul className="hidden items-center gap-x-8 small:flex">
              {header.links.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <NavLink
                    href={link.href}
                    label={link.label}
                    className="rv-eyebrow text-rv-grafite"
                    data-testid={`${link.label.toLowerCase()}-link`}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Right — action icons. `bag` is the cart: it is the only one
              with state, so it renders through `CartButton`. */}
          <div className="flex h-full items-center justify-end gap-x-2 small:gap-x-3">
            {header.actions.map((action) =>
              action.icon === "bag" ? (
                <Suspense
                  key={`${action.label}-${action.href}`}
                  fallback={
                    <NavLink
                      href={action.href}
                      label={action.label}
                      icon={action.icon}
                      variant="icon"
                      count={0}
                      data-testid="nav-cart-link"
                    />
                  }
                >
                  <CartButton href={action.href} label={action.label} />
                </Suspense>
              ) : (
                <NavLink
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  label={action.label}
                  icon={action.icon}
                  variant="icon"
                  data-testid={`nav-${action.label.toLowerCase()}-link`}
                />
              )
            )}
          </div>
        </nav>
      </header>
    </div>
  )
}
