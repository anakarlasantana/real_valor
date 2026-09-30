import { type CollectionsSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Collections — the editorial band of the home.
 *
 * Two formats, and the shopkeeper picks between them in the CRM
 * (`section.layout`):
 *
 *   cards   — a grade de três cartões altos (3/4), como a seção nasceu;
 *   banners — uma linha de **dois banners largos** (16/9 no desktop), um ao
 *             lado do outro, para quando as fotos são horizontais.
 *
 * Nenhuma escolha é "melhor": o formato depende da foto que a loja tem. Um
 * recorte 3/4 numa foto horizontal corta a peça, e é por isso que o formato é
 * escolha e não um reajuste automático — a loja sabe qual foto mandou.
 *
 * O protótipo hard-coded the three names. Here they are data, so the CMS can
 * retitle, reorder or re-image them later.
 */
const LAYOUTS = {
  cards: {
    list: "grid grid-cols-1 gap-6 small:grid-cols-3",
    frame: "aspect-[3/4]",
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  banners: {
    list: "grid grid-cols-1 gap-6 small:grid-cols-2",
    frame: "aspect-[4/3] small:aspect-[16/9]",
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
} as const

export default function CollectionHighlights({
  section,
}: {
  section: CollectionsSection
}) {
  if (!section.items?.length) {
    return null
  }

  // Campo vazio ou desconhecido cai em `cards` — o desenho de antes do campo
  // existir. É a regra de todo campo novo do contrato: ausente é "como era".
  const layout = section.layout === "banners" ? LAYOUTS.banners : LAYOUTS.cards

  return (
    <section className="rv-section-pad w-full">
      <div className="rv-container">
        <header className="mb-10 max-w-[620px] small:mb-14">
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

        <ul className={layout.list}>
          {section.items.map((item) => {
            // A imagem pode chegar como chave crua do provider (upload pelo
            // CRM) ou como URL do backend — ver `lib/util/media.ts`.
            const image = resolveMediaUrl(item.imageUrl)

            return (
              <li key={item.title} className="group">
                <LocalizedClientLink
                  href={item.href}
                  className="block focus:outline-none"
                >
                  <div
                    className={`relative ${layout.frame} w-full overflow-hidden bg-rv-dourado/20`}
                  >
                    {image && (
                      <Image
                        src={image}
                        alt={item.imageAlt}
                        fill
                        sizes={layout.sizes}
                        className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-rv-preto/70 via-rv-preto/10 to-transparent"
                    />

                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="rv-display rv-section-heading-onmedia text-2xl">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="rv-section-text-inherit mt-1 text-small-regular">
                          {item.subtitle}
                        </p>
                      )}
                      <span className="rv-eyebrow rv-section-accent-onmedia mt-4 inline-block border-b border-rv-dourado pb-1">
                        {item.ctaLabel}
                      </span>
                    </div>
                  </div>
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
