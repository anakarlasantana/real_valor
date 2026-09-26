import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

/**
 * Main navigation — matches the prototype: logo left, links centred,
 * actions right on a `1fr auto 1fr` grid.
 *
 * This replaced the previous centred-wordmark + left-menu arrangement.
 * On mobile the centre links are hidden and the drawer (`SideMenu`)
 * takes over, which is why it sits in the left column.
 *
 * Labels follow the prototype's menu: Início, Coleções, Alfaiataria,
 * Sobre, Contato.
 */
const NAV_LINKS = [
  { label: "Início", href: "/" },
  { label: "Coleções", href: "/collections" },
  { label: "Alfaiataria", href: "/store" },
  { label: "Sobre", href: "/store" },
  { label: "Contato", href: "/account" },
]

export default async function Nav() {
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

          {/* Centre — primary links. */}
          <ul className="hidden items-center gap-x-8 small:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <LocalizedClientLink
                  className="rv-eyebrow text-rv-grafite transition-colors duration-200 hover:text-rv-rose"
                  href={link.href}
                >
                  {link.label}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>

          {/* Right — actions. */}
          <div className="flex h-full items-center justify-end gap-x-5">
            <LocalizedClientLink
              className="rv-eyebrow hidden text-rv-grafite transition-colors duration-200 hover:text-rv-rose small:inline-flex"
              href="/account"
              data-testid="nav-account-link"
            >
              Conta
            </LocalizedClientLink>

            <Suspense
              fallback={
                <LocalizedClientLink
                  className="rv-eyebrow flex gap-2 text-rv-grafite"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  Sacola (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
