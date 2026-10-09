import { type CollectionsSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import ArrowIcon from "@modules/common/components/arrow-icon"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

/**
 * Collections — a faixa editorial da home.
 *
 * Dois formatos, e é o lojista quem escolhe no CRM (`section.layout`):
 *
 *   cards   — a grade de três quadros altos, como a seção nasceu, **em degrau**:
 *             a coluna do meio é mais estreita e desce 4rem;
 *   banners — uma linha de **dois banners largos** (16/9 no desktop), um ao lado
 *             do outro, para quando as fotos são horizontais. Sem degrau.
 *
 * Nenhuma escolha é "melhor": o formato depende da foto que a loja tem. Um
 * recorte 3/4 numa foto horizontal corta a peça, e é por isso que o formato é
 * escolha e não um reajuste automático — a loja sabe qual foto mandou.
 *
 * O protótipo trazia os três nomes escritos no código. Aqui eles são dado, para o
 * CMS renomear, reordenar ou trocar a foto depois.
 *
 * **O que o redesenho mudou** (o desenho está em `brand.css`, `.rv-collection-*`):
 * o cabeçalho é centrado; as colunas viraram 1,1fr / 0,9fr / 1,1fr com a do meio
 * descendo; a altura do quadro passou a ser da faixa (`clamp(430px, 49vw, 650px)`
 * no desktop) em vez da proporção da foto; a legenda inverteu a ordem — o rótulo
 * miúdo em caixa alta **acima** do nome, que virou `h3` em `clamp(2rem, 3vw, 3rem)`
 * — e o cartão ganhou o **número** no canto e a chamada em caixa alta com a seta
 * ao lado. Nada disso é conteúdo novo: o número sai do índice (ver
 * `collectionNumber`) e o resto já vinha do CMS.
 */
const LAYOUTS = {
  cards: {
    list: "rv-collection-grid",
    frame: "rv-collection-card",
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  banners: {
    list: "rv-collection-grid rv-collection-grid-wide",
    frame: "rv-collection-card rv-collection-card-wide",
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
    <section className="rv-section-pad rv-collections w-full">
      <div className="rv-container">
        <header className="rv-collections-head">
          {section.eyebrow && (
            <p className="rv-eyebrow rv-section-eyebrow rv-section-accent">
              {section.eyebrow}
            </p>
          )}
          <h2 className="rv-display rv-section-heading rv-section-title">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="rv-section-text rv-section-subtitle">
              {section.subtitle}
            </p>
          )}
        </header>

        <ul className={layout.list}>
          {section.items.map((item, index) => {
            // A imagem pode chegar como chave crua do provider (upload pelo
            // CRM) ou como URL do backend — ver `lib/util/media.ts`.
            const image = resolveMediaUrl(item.imageUrl)

            return (
              <li key={item.title}>
                <LocalizedClientLink
                  href={item.href}
                  className="block focus:outline-none"
                >
                  <div className={layout.frame}>
                    {image && (
                      <Image
                        src={image}
                        alt={item.imageAlt}
                        fill
                        sizes={layout.sizes}
                        className="rv-collection-photo"
                      />
                    )}
                    <div aria-hidden="true" className="rv-collection-shade" />

                    <span className="rv-collection-number">
                      {collectionNumber(index)}
                    </span>

                    <div className="rv-collection-copy">
                      {item.subtitle && (
                        <p className="rv-collection-label">{item.subtitle}</p>
                      )}
                      <h3 className="rv-display rv-collection-title">
                        {item.title}
                      </h3>
                      {item.ctaLabel && (
                        <span className="rv-collection-cta">
                          {item.ctaLabel}
                          <ArrowIcon className="rv-collection-cta-icon" />
                        </span>
                      )}
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

/**
 * O número do cartão — "01", "02", "03".
 *
 * Ele é a **posição** do item na lista, e não um campo do conteúdo: a régua
 * numera a faixa na ordem em que ela aparece, então reordenar as coleções no CRM
 * renumera os cartões sozinho. Um campo "número" no formulário seria mais um
 * lugar para o lojista errar a sequência (e a ordem das listas já é editável).
 *
 * Dois dígitos sempre, com o zero à esquerda, para o número não dançar de largura
 * entre "09" e "10".
 */
function collectionNumber(index: number): string {
  return String(index + 1).padStart(2, "0")
}
