import { type FooterColumn as FooterColumnContent } from "@lib/content/home-sections"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import NavLink from "@modules/layout/components/nav-link"

/**
 * Coluna do rodapé — cromo do site, renderizado pelo layout.
 *
 * Uma coluna é sempre conteúdo do CMS: o rodapé não tem coluna fixa nem
 * automática, e o lojista insere, edita, reordena e remove **todas** pelo
 * mesmo editor do admin. O que muda entre elas é só a origem dos itens,
 * escolhida por coluna em `source`:
 *
 *   `links`       → os links digitados no admin
 *   `categories`  → as categorias do catálogo, ao vivo
 *   `collections` → as coleções do catálogo, ao vivo
 *
 * Um `source` ausente ou desconhecido conta como `links`: é o que um
 * registro gravado antes deste campo significa. O catálogo é buscado pelo
 * rodapé só quando alguma coluna aponta para ele (ver `footer/index.tsx`),
 * então uma coluna digitada à mão não custa requisição.
 *
 * Regra de ouro das listas: vazia esconde o bloco. Coluna sem título ou
 * sem itens não aparece — é o que permite publicar o rodapé antes de o
 * catálogo existir.
 *
 * Os links digitados passam pelo `nav-link`, o mesmo do cabeçalho: um
 * `href` do CMS pode ser âncora (`/#editorial`), rota interna, `https://`
 * ou `mailto:`/`tel:`, e quem decide o comportamento é aquele componente
 * — não este.
 */

/** Teto de itens por coluna de catálogo, para o rodapé não virar um
 *  índice de produtos. Não vale para os links digitados, que são poucos
 *  por natureza. */
const MAX_CATALOG_ITEMS = 6

const LINK_CLASSES = "transition-colors duration-200 hover:text-rv-rose"

/** Casca da coluna: título + o que vier dentro. */
function ColumnShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-[8.5rem] flex-col gap-y-2">
      <span className="rv-eyebrow text-rv-grafite">{title}</span>
      {children}
    </div>
  )
}

export default function FooterColumn({
  column,
  categories,
  collections,
}: {
  column: FooterColumnContent
  /** Só as colunas de origem `categories` usam; as outras recebem vazio. */
  categories: HttpTypes.StoreProductCategory[]
  /** Só as colunas de origem `collections` usam; as outras recebem vazio. */
  collections: HttpTypes.StoreCollection[]
}) {
  // Título é o rótulo da coluna: sem ele não há o que mostrar.
  if (!column.title) {
    return null
  }

  if (column.source === "categories") {
    // Subcategoria não vira item de primeira linha: ela já sai aninhada
    // na mãe, como no catálogo.
    const items = categories
      .filter((category) => !category.parent_category)
      .slice(0, MAX_CATALOG_ITEMS)

    if (items.length === 0) {
      return null
    }

    return (
      <ColumnShell title={column.title}>
        <ul className="grid grid-cols-1 gap-2" data-testid="footer-categories">
          {items.map((category) => {
            const children =
              category.category_children?.map((child) => ({
                id: child.id,
                name: child.name,
                handle: child.handle,
              })) ?? []

            return (
              <li
                className="flex flex-col gap-2 text-rv-muted txt-small"
                key={category.id}
              >
                <LocalizedClientLink
                  className={clx(
                    LINK_CLASSES,
                    children.length > 0 && "txt-small-plus"
                  )}
                  href={`/categories/${category.handle}`}
                  data-testid="category-link"
                >
                  {category.name}
                </LocalizedClientLink>
                {children.length > 0 && (
                  <ul className="grid grid-cols-1 ml-3 gap-2">
                    {children.map((child) => (
                      <li key={child.id}>
                        <LocalizedClientLink
                          className={LINK_CLASSES}
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
      </ColumnShell>
    )
  }

  if (column.source === "collections") {
    const items = collections.slice(0, MAX_CATALOG_ITEMS)

    if (items.length === 0) {
      return null
    }

    return (
      <ColumnShell title={column.title}>
        <ul
          className={clx("grid grid-cols-1 gap-2 text-rv-muted txt-small", {
            // Título de coleção é curto: em duas colunas cabem mais sem
            // estourar a largura da linha.
            "grid-cols-2": items.length > 3,
          })}
        >
          {items.map((collection) => (
            <li key={collection.id}>
              <LocalizedClientLink
                className={LINK_CLASSES}
                href={`/collections/${collection.handle}`}
              >
                {collection.title}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </ColumnShell>
    )
  }

  const links = column.links ?? []

  if (links.length === 0) {
    return null
  }

  return (
    <ColumnShell title={column.title}>
      <ul className="grid grid-cols-1 gap-y-2 text-rv-muted txt-small">
        {links.map((link, index) => (
          <li key={`${link.href}-${index}`}>
            <NavLink
              href={link.href}
              label={link.label}
              data-testid="footer-link"
            />
          </li>
        ))}
      </ul>
    </ColumnShell>
  )
}
