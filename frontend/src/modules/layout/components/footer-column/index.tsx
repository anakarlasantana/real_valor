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

/**
 * As duas roupas de cor da coluna, uma por fundo.
 *
 * A coluna não declara cor nenhuma: ela **recebe** a sua, e é por isso
 * que este mapa existe em vez de um `text-rv-muted` escrito direto. O
 * problema não é gosto — `brand.css` não resolveria por escopo, porque é
 * importado **antes** dos utilitários (`globals.css`) e um `text-rv-muted`
 * deixado no elemento ganharia de qualquer regra de lá. Com o rodapé em
 * preto e o corpo da loja em off-white, a cor precisa ser escolha de quem
 * monta a coluna.
 *
 * O realce do hover **não** entra aqui: ele é `hover:text-rv-rose` nos
 * dois fundos, o mesmo de todo link de texto da loja. O rosa sobre o
 * preto dá 5,2:1, que passa no AA para texto normal — não há motivo para
 * inventar um segundo realce.
 */
type FooterTone = "light" | "dark"

/** O link de uma coluna. Igual nos dois fundos — ver a nota acima. */
const LINK_CLASSES = "transition-colors duration-200 hover:text-rv-rose"

const COLUMN_TONE: Record<FooterTone, { title: string; body: string }> = {
  /* No corpo da loja: título em grafite, texto em muted. */
  light: {
    title: "text-rv-grafite",
    body: "text-rv-muted",
  },
  /* No rodapé preto: título em dourado, texto no off-white esmaecido. */
  dark: {
    title: "text-rv-dourado",
    body: "text-rv-ondark-muted",
  },
}

/** Casca da coluna: título + o que vier dentro, na cor do fundo. */
function ColumnShell({
  title,
  titleTone,
  children,
}: {
  title: string
  /** A classe de cor do título, já resolvida pelo mapa acima. */
  titleTone: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-[8.5rem] flex-col gap-y-2">
      <span className={clx("rv-eyebrow", titleTone)}>{title}</span>
      {children}
    </div>
  )
}

export default function FooterColumn({
  column,
  categories,
  collections,
  tone = "light",
}: {
  column: FooterColumnContent
  /** Só as colunas de origem `categories` usam; as outras recebem vazio. */
  categories: HttpTypes.StoreProductCategory[]
  /** Só as colunas de origem `collections` usam; as outras recebem vazio. */
  collections: HttpTypes.StoreCollection[]
  /** O fundo em que a coluna está posta. O rodapé é preto: passa `dark`. */
  tone?: FooterTone
}) {
  const { title: titleTone, body: bodyTone } = COLUMN_TONE[tone]

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
      <ColumnShell title={column.title} titleTone={titleTone}>
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
                className={clx("flex flex-col gap-2 txt-small", bodyTone)}
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
      <ColumnShell title={column.title} titleTone={titleTone}>
        <ul
          className={clx("grid grid-cols-1 gap-2 txt-small", bodyTone, {
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
    <ColumnShell title={column.title} titleTone={titleTone}>
      <ul
        className={clx("grid grid-cols-1 gap-y-2 txt-small", bodyTone)}
      >
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
