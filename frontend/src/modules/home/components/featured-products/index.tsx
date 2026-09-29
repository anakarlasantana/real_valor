import { type FeaturedSection } from "@lib/content/home-sections"
import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import { HttpTypes } from "@medusajs/types"

/**
 * Featured products — the "Peças em destaque" rail.
 *
 * O filtro é um parâmetro de verdade (`?peca=vestidos`) sobre uma consulta de
 * catálogo de verdade: o chip carrega um `categoryId`, então a Store API filtra
 * por `category_id` — o mesmo caminho que a listagem da loja usa.
 *
 * É a diferença que a R1 conserta. Antes os chips eram rótulos **copiados** para
 * dentro da seção (`"Blazers"` entre eles) e a vitrine mandava o rótulo como
 * busca (`q=Blazers`). Medido no catálogo real: "Blazers" não existe — aquele
 * chip devolvia zero peças **em silêncio**, e renomear uma categoria no painel
 * não mudava chip nenhum. Aqui o rótulo é só o que se lê no botão; quem filtra é
 * a categoria, e a ordem dos chips é a que o lojista escolheu no CRM.
 *
 * **"Todos" não vem do CMS.** Não existe categoria "todas": o chip que limpa o
 * filtro é desenhado aqui, e `section.filters` traz só as categorias escolhidas.
 * Antes ele era o primeiro item da lista — `filters[0]` —, e reordenar os chips
 * trocava o significado de cada um sem nada acusar.
 *
 * Products always come from the Store API — the content section carries the
 * copy (title, subtitle, chips).
 */
/** O chip que limpa o filtro. É cópia da loja, não conteúdo do CMS. */
const ALL_LABEL = "Todos"

/** O visual de um chip: ativo é preenchido, inativo é contorno. */
const chipClass = (isActive: boolean) =>
  "rv-eyebrow whitespace-nowrap border px-4 py-2 transition-colors duration-200 ease-in " +
  (isActive
    ? "border-rv-grafite bg-rv-grafite text-rv-offwhite"
    : "border-rv-border text-rv-grafite hover:border-rv-rose hover:text-rv-rose")


export default async function FeaturedProducts({
  section,
  region,
  selectedFilter,
}: {
  section: FeaturedSection
  region: HttpTypes.StoreRegion
  /** O chip ativo, pelo `handle` da categoria; ausente é "todos". */
  selectedFilter?: string
}) {
  const chips = section.filters ?? []
  // Handle que não é de nenhum chip — um link antigo, uma categoria renomeada —
  // não filtra nada em vez de devolver zero peças: sem chip ativo, a lista é o
  // catálogo. É a mesma tolerância do resto da loja: o que não se reconhece é
  // ignorado, nunca quebra a página.
  const active = selectedFilter
    ? chips.find((chip) => chip.handle === selectedFilter)
    : undefined

  const queryParams: HttpTypes.FindParams & HttpTypes.StoreProductListParams = {
    limit: 8,
    fields: "*variants.calculated_price,+variants.images,+metadata,+tags",
  }

  // O filtro é a **categoria**: `category_id` é o mesmo parâmetro da listagem da
  // loja (`modules/store/templates/paginated-products.tsx`), então o chip e a
  // página de categoria filtram pelo mesmo caminho do catálogo — e não por
  // semelhança de texto no título.
  if (active) {
    queryParams["category_id"] = [active.categoryId]
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
            <p className="rv-eyebrow rv-section-accent mb-4">
              {section.eyebrow}
            </p>
          )}
          <h2 className="rv-display rv-section-heading text-[28px] leading-tight small:text-[40px]">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="rv-section-text mt-4 text-base leading-relaxed">
              {section.subtitle}
            </p>
          )}
        </header>

        {chips.length > 0 && (
          <nav
            aria-label="Filtrar peças em destaque"
            className="no-scrollbar mb-10 flex items-center gap-2 overflow-x-auto border-b border-rv-border pb-4"
          >
            {/* O chip que limpa o filtro: desenhado pela loja, porque não há
                categoria "todas" para o CMS apontar. */}
            <LocalizedClientLink
              href="/"
              scroll={false}
              aria-current={active ? undefined : "true"}
              data-testid="featured-filter-todos"
              className={chipClass(!active)}
            >
              {ALL_LABEL}
            </LocalizedClientLink>

            {chips.map((chip) => {
              const isActive = chip.categoryId === active?.categoryId

              return (
                <LocalizedClientLink
                  key={chip.categoryId}
                  href={`/?peca=${encodeURIComponent(chip.handle)}`}
                  scroll={false}
                  aria-current={isActive ? "true" : undefined}
                  data-testid={`featured-filter-${chip.handle}`}
                  className={chipClass(isActive)}
                >
                  {chip.label}
                </LocalizedClientLink>
              )
            })}
          </nav>
        )}

        {products?.length ? (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 small:grid-cols-4 small:gap-y-14">
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} isFeatured />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rv-section-text py-10 text-base">
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
