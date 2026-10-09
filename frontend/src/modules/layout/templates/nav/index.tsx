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
 * actions right on a `1fr 2fr 1fr` grid.
 *
 * The menu is content, not code: labels, destinations, order and
 * visibility come from the `nav` block of the CMS (edited at Admin →
 * Conteúdo da vitrine). The header travels in the same payload as the
 * home, so `layout.tsx` resolves it once with `headerSections()` and
 * passes it down — and this component stays a pure renderer.
 *
 * The bag action is the exception: it is the only one with state, so it
 * delegates to `CartButton`.
 *
 * Sobre o fundo: o protótipo escreve `rgba(surface, .96)`, mas lá o
 * cabeçalho não é fixo — o alfa não faz nada. Aqui ele é `sticky`, e
 * neste caso o alfa apareceria como um vazamento do conteúdo por trás do
 * texto; sem desfoque, isso se lê como falha de pintura, não como
 * transparência. `bg-rv-surface` cheio é a tradução correta: mesma cor,
 * sem o vazamento.
 */
export default async function Nav({ header }: { header: NavSection }) {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-20 border-b bg-rv-surface border-rv-border">
        <nav className="rv-container grid h-full grid-cols-[1fr_2fr_1fr] items-center gap-4">
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
              className="rv-brand-lockup"
              data-testid="nav-store-link"
              aria-label="Real Valor — página inicial"
            >
              <span className="rv-brand-lockup-name">REAL VALOR</span>
              <span className="rv-eyebrow mt-1 hidden text-rv-rose small:block">
                Alfaiataria feminina
              </span>
            </LocalizedClientLink>
          </div>

          {/* Centre — primary links, straight from the CMS. `justify-center`
              é o que faz a coluna do meio parecer o centro da página: as
              duas colunas laterais medem `1fr` cada, então centralizar
              dentro da coluna central é centralizar no cabeçalho. */}
          {header.links.length > 0 && (
            <ul className="hidden items-center justify-center gap-x-8 small:flex">
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
              with state, so it renders through `CartButton`.
              O `col-start-3` não é decorativo: a lista de links é
              `display: none` abaixo de `small`, e um item que não gera
              caixa não ocupa trilho nenhum. Sem a âncora, as ações
              escorregariam para o trilho do meio e a sacola ficaria a um
              quarto da borda direita. Ancoradas no terceiro trilho, elas
              encostam na direita em qualquer largura. */}
          <div className="rv-header-actions col-start-3">
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
