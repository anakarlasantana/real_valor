import { type LaunchesSection } from "@lib/content/home-sections"
import { listProducts } from "@lib/data/products"
import { launchesLimit } from "@lib/util/launches"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import { HttpTypes } from "@medusajs/types"

/**
 * Lançamentos — o trilho de novidades logo depois do hero.
 *
 * A seção carrega só a cópia; **os produtos vêm da loja**, do mais novo para o
 * mais antigo. É o que faz o trilho se manter sozinho: publicar uma peça no
 * painel já a coloca aqui, sem ninguém editar bloco. Quem escolhe *quais* peças
 * (curadoria) é o próximo passo — `kind: "products"` no contrato.
 *
 * Duas decisões de layout, e o motivo de cada uma:
 *
 * 1. **Trilho, não grade.** O bloco responde "o que chegou?", e a resposta é uma
 *    sequência, não um quadro: `overflow-x-auto` com `snap-x` deixa o gesto
 *    horizontal e cada card para no lugar certo. A grade fica na seção "Peças em
 *    destaque", que é catálogo.
 * 2. **Card estreito, largura de grade.** `w-[68%]` no celular (o card seguinte
 *    aparecendo de esguelha é o que ensina que há mais à direita) e a mesma
 *    largura da grade de 4 no desktop, para o olho não trocar de régua entre
 *    uma seção e outra.
 *
 * `limit` passa por `launchesLimit`: a faixa é do contrato e a API já a
 * confere, mas o que está gravado pode ser anterior à faixa (ver
 * `lib/util/launches.ts`).
 */
export default async function LaunchesRail({
  section,
  region,
}: {
  section: LaunchesSection
  region: HttpTypes.StoreRegion
}) {
  const limit = launchesLimit(section.limit)

  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit,
      // "-created_at" é o "acabou de chegar" do banco, e não uma escolha de
      // ninguém: quem publica não precisa lembrar de incluir a peça no trilho.
      order: "-created_at",
      fields: "*variants.calculated_price,+variants.images,+metadata,+tags",
    },
  })

  return (
    <section className="w-full py-16 small:py-20">
      <div className="rv-container">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 small:mb-10">
          <div className="max-w-[620px]">
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
          </div>

          {section.viewAllLabel && (
            <LocalizedClientLink
              href={section.viewAllHref || "/store"}
              className="rv-eyebrow whitespace-nowrap border-b border-rv-dourado pb-1 text-rv-rose transition-colors duration-200 ease-in hover:text-rv-grafite"
            >
              {section.viewAllLabel}
            </LocalizedClientLink>
          )}
        </header>

        {products?.length ? (
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-2 small:mx-0 small:px-0">
            {products.map((product) => (
              <li
                key={product.id}
                // `snap-start` é o que faz o card parar alinhado à esquerda em
                // vez de parar onde o dedo largou.
                className="w-[68%] shrink-0 snap-start small:w-[260px]"
              >
                <ProductPreview product={product} region={region} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rv-section-text py-10 text-base">
            Nenhuma peça publicada ainda. As novidades aparecem aqui conforme
            entrarem na loja.
          </p>
        )}
      </div>
    </section>
  )
}
