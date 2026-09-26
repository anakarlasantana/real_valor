import { type FeaturedSection } from "@lib/content/home-sections"
import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import { HttpTypes } from "@medusajs/types"

/**
 * Featured products — the "Peças em destaque" rail.
 *
 * Two differences from the prototype, both deliberate:
 *
 * 1. The prototype filtered cards client-side by toggling
 *    `card.style.display`. Here the filter is a real query parameter
 *    (`?peca=Blazers`) resolved by the Medusa Store API, so the URL is
 *    shareable and the catalogue never has to be shipped wholesale.
 * 2. The prototype had one rail per collection. This is a single rail
 *    with filter chips, matching the prototype's layout.
 *
 * Products always come from the Store API — the content section only
 * carries the copy (title, subtitle, filter labels).
 */
export default async function FeaturedProducts({
  section,
  region,
  selectedFilter,
}: {
  section: FeaturedSection
  region: HttpTypes.StoreRegion
  /** Active chip; the first entry in `section.filters` means "all". */
  selectedFilter?: string
}) {
  const filters = section.filters ?? []
  const allLabel = filters[0]
  const active =
    selectedFilter && selectedFilter !== allLabel ? selectedFilter : undefined

  const queryParams: HttpTypes.FindParams & HttpTypes.StoreProductListParams = {
    limit: 8,
    fields: "*variants.calculated_price,+variants.images,+metadata,+tags",
  }

  // Medusa matches `q` against title/handle/description, which is the
  // closest server-side equivalent of the prototype's client-side
  // name filtering — and it stays generic, so the admin keeps control
  // of the chip labels.
  if (active) {
    queryParams.q = active
  }

  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams,
  })

  return (
    <section className="w-full py-16 small:py-24">
      <div className="rv-container">
        <header className="mb-8 max-w-[620px] small:mb-10">
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

        {filters.length > 1 && (
          <nav
            aria-label="Filtrar peças em destaque"
            className="no-scrollbar mb-10 flex items-center gap-2 overflow-x-auto border-b border-rv-border pb-4"
          >
            {filters.map((filter) => {
              const isAll = filter === allLabel
              const isActive = isAll ? !active : filter === active
              const href = isAll ? "/" : `/?peca=${encodeURIComponent(filter)}`

              return (
                <LocalizedClientLink
                  key={filter}
                  href={href}
                  scroll={false}
                  aria-current={isActive ? "true" : undefined}
                  data-testid={`featured-filter-${filter.toLowerCase()}`}
                  className={
                    "rv-eyebrow whitespace-nowrap border px-4 py-2 transition-colors duration-200 ease-in " +
                    (isActive
                      ? "border-rv-grafite bg-rv-grafite text-rv-offwhite"
                      : "border-rv-border text-rv-grafite hover:border-rv-rose hover:text-rv-rose")
                  }
                >
                  {filter}
                </LocalizedClientLink>
              )
            })}
          </nav>
        )}

        {products?.length ? (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 small:grid-cols-4 small:gap-y-14">
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview
                  product={product}
                  region={region}
                  isFeatured
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-base text-rv-muted">
            Nenhuma peça encontrada para este filtro.
          </p>
        )}

        <div className="mt-12 flex justify-center">
          <LocalizedClientLink
            href="/store"
            className="rv-eyebrow inline-flex items-center justify-center border border-rv-grafite px-8 py-4 text-rv-grafite transition-colors duration-200 ease-in hover:bg-rv-grafite hover:text-rv-offwhite"
          >
            {section.viewAllLabel}
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
