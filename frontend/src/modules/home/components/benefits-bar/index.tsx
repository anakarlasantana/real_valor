import { resolveIcon } from "@lib/content/icons"
import { type BenefitsSection } from "@lib/content/home-sections"

/**
 * Benefits bar — reassurance items right under the hero.
 *
 * A quantidade de itens vem do CMS (lista `items`, editável em
 * **Conteúdo da vitrine**), então a faixa não pode assumir quatro colunas:
 * com 1, 2, 5 ou 9 itens um `grid-cols-4` fixo deixava a linha pela metade
 * e o item excedente órfão numa segunda linha sem divisórias.
 *
 * No lugar, os itens são uma linha flex que quebra sozinha, com um `basis`
 * sensível à largura disponível — dois por linha no celular, 11rem no
 * desktop — e `grow` para a última linha sempre se preencher (um quinto
 * item sozinho vira uma linha inteira, em vez de deixar buraco). As
 * divisórias são o `gap` de 1px deixando aparecer o fundo do container:
 * assim continuam corretas nos **dois** eixos em qualquer contagem, o que
 * `divide-x`/`divide-y` não consegue depois que a linha quebra.
 *
 * O número de colunas não é calculado em JS de propósito: a mesma faixa
 * precisa se comportar bem em 375px e em 1440px, e isso é trabalho do
 * layout, não do componente. Icons are resolved from a string key so the
 * CMS can drive them without shipping code (see `lib/content/icons.ts`).
 */
export default function BenefitsBar({
  items,
}: {
  items: BenefitsSection["items"]
}) {
  if (!items?.length) {
    return null
  }

  return (
    <section
      aria-label="Vantagens"
      className="rv-section-bg-surface w-full border-b border-rv-border"
    >
      <div className="rv-container">
        <ul
          data-testid="benefits-bar"
          data-count={items.length}
          className="flex flex-wrap gap-px bg-rv-border"
        >
          {items.map((item, index) => {
            const Icon = resolveIcon(item.icon)

            return (
              <li
                key={`${item.title}-${index}`}
                data-testid="benefit-item"
                className="rv-section-bg-surface flex grow basis-[calc(50%_-_1px)] flex-col items-center justify-center gap-2 px-4 py-6 text-center small:basis-[11rem] small:py-8"
              >
                <Icon
                  className="rv-section-accent h-5 w-5"
                  aria-hidden="true"
                  focusable="false"
                />
                <p className="text-small-semi rv-section-heading-sans uppercase tracking-[0.12em]">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xsmall-regular rv-section-text">
                    {item.subtitle}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
