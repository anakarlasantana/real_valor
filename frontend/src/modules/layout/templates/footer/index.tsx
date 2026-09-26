import { type FooterSection } from "@lib/content/home-sections"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import FooterColumn from "@modules/layout/components/footer-column"
import SocialLinks from "@modules/layout/components/social-links"

/**
 * Rodapé — cromo do site, renderizado pelo layout em todas as rotas.
 *
 * O que o lojista escreve vem do bloco `footer` do CMS (colunas de links e
 * redes sociais), resolvido pelo layout com `footerSections()` e passado
 * pronto para cá, igual ao cabeçalho. O que **não** é conteúdo continua no
 * JSX: a marca, a frase manuscrita e a linha de direitos.
 *
 * As colunas são todas conteúdo: não há coluna fixa no componente, e a de
 * catálogo é só uma origem possível (`source`), escolhida por coluna —
 * ver `FooterColumn`. Por isso o catálogo só é buscado quando alguma
 * coluna aponta para ele: um rodapé com colunas digitadas à mão (ou sem
 * coluna nenhuma) não paga requisição nenhuma.
 *
 * Regra de ouro das listas: vazia esconde o bloco. Vale para as colunas,
 * que é o que permite publicar o rodapé antes de ter tudo.
 *
 * Os links das colunas passam pelo `nav-link`, o mesmo do cabeçalho: um
 * `href` do CMS pode ser âncora (`/#editorial`), rota interna, `https://`
 * ou `mailto:`/`tel:`, e quem decide o comportamento é aquele componente —
 * não este.
 */
export default async function Footer({ content }: { content: FooterSection }) {
  const columns = content.columns ?? []

  const needsCategories = columns.some(
    (column) => column.source === "categories"
  )
  const needsCollections = columns.some(
    (column) => column.source === "collections"
  )

  const productCategories: HttpTypes.StoreProductCategory[] = needsCategories
    ? await listCategories()
    : []

  const collections: HttpTypes.StoreCollection[] = needsCollections
    ? (await listCollections({ fields: "*products" })).collections
    : []

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

            <SocialLinks items={content.social ?? []} />
          </div>

          <div className="text-small-regular flex flex-wrap gap-x-10 gap-y-8 md:gap-x-16">
            {/* Uma volta por coluna, na ordem da lista. O rodapé não tem
                coluna fixa: cada uma diz de onde vêm os itens (`source`), e
                coluna sem título ou sem itens não aparece — assim o lojista
                publica o rodapé antes de ter tudo. */}
            {columns.map((column, index) => (
              <FooterColumn
                key={`${column.title}-${index}`}
                column={column}
                categories={productCategories}
                collections={collections}
              />
            ))}
          </div>
        </div>
        <div className="flex w-full mb-10 justify-center text-rv-muted">
          <Text className="txt-compact-small text-center">
            © {new Date().getFullYear()} Real Valor. Todos os direitos
            reservados.
            {" · "}
            Desenvolvido por{" "}
            <a
              href="https://ana-karla-dev.vercel.app/"
              className="transition-opacity hover:opacity-70"
            >
              Ana Karla Santana
            </a>
          </Text>
        </div>
      </div>
    </footer>
  )
}
