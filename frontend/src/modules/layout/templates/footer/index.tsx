import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  })
  const productCategories = await listCategories()

  return (
    <footer className="border-t border-rv-border w-full bg-rv-offwhite">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-10 small:flex-row items-start justify-between py-20">
          <div className="flex flex-col gap-y-4 max-w-xs">
            <LocalizedClientLink
              href="/"
              className="flex flex-col leading-none"
              aria-label="Real Valor — página inicial"
            >
              <span className="rv-display text-2xl tracking-[0.3em] text-rv-preto">
                REAL VALOR
              </span>
              <span className="rv-eyebrow mt-1 text-rv-rose">
                Alfaiataria feminina
              </span>
            </LocalizedClientLink>

            <Text className="rv-script text-3xl text-rv-rose">
              Mais que roupas, é sobre você.
            </Text>

            <Text className="text-sm leading-relaxed text-rv-muted">
              A alfaiataria que valoriza você, não o seu status.
            </Text>

            <span className="rv-eyebrow text-rv-dourado">
              Alfaiataria para todas.
            </span>
          </div>

          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="rv-eyebrow text-rv-grafite">
                  Categorias
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className="flex flex-col gap-2 text-rv-muted txt-small"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "transition-colors duration-200 hover:text-rv-rose",
                            children && "txt-small-plus"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="transition-colors duration-200 hover:text-rv-rose"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="rv-eyebrow text-rv-grafite">
                  Coleções
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 text-rv-muted txt-small",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="transition-colors duration-200 hover:text-rv-rose"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="rv-eyebrow text-rv-grafite">Ajuda</span>
              <ul className="grid grid-cols-1 gap-y-2 text-rv-muted txt-small">
                <li>
                  <LocalizedClientLink
                    href="/account"
                    className="transition-colors duration-200 hover:text-rv-rose"
                  >
                    Minha conta
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/cart"
                    className="transition-colors duration-200 hover:text-rv-rose"
                  >
                    Sacola
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/account"
                    className="transition-colors duration-200 hover:text-rv-rose"
                  >
                    Contato
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-10 justify-between text-rv-muted">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} Real Valor. Todos os direitos
            reservados.
          </Text>
        </div>
      </div>
    </footer>
  )
}
