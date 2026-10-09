import { resolveIcon } from "@lib/content/icons"
import { type BenefitsSection } from "@lib/content/home-sections"

/**
 * Benefits bar — a tarja de vantagens logo abaixo da capa.
 *
 * A quantidade de itens vem do CMS (lista `items`, editável em
 * **Conteúdo da vitrine**), então a faixa não pode assumir três colunas:
 * com 1, 2, 5 ou 9 itens um `grid-cols-3` fixo deixaria a linha pela metade
 * e o item excedente órfão numa segunda linha sem divisórias.
 *
 * No lugar, os itens são uma linha flex que quebra sozinha: no celular cada um
 * ocupa a linha inteira (um por linha, como na régua) e do desktop para cima a
 * base de 11rem com `grow` reparte a faixa em partes iguais — com os três itens
 * de fábrica, um terço para cada um, exatamente o desenho do protótipo.
 *
 * As divisórias são o `gap` de 1px deixando aparecer o fundo do container:
 * assim continuam corretas nos **dois** eixos em qualquer contagem, o que
 * `divide-x`/`divide-y` não consegue depois que a linha quebra.
 *
 * O número de colunas não é calculado em JS de propósito: a mesma faixa
 * precisa se comportar bem em 375px e em 1440px, e isso é trabalho do
 * layout, não do componente. Icons are resolved from a string key so the
 * CMS can drive them without shipping code (see `lib/content/icons.ts`).
 *
 * O que a régua mudou (o desenho está em `brand.css`, `.rv-benefits`): a faixa
 * virou uma **tarja** de 100px com o respiro lateral de 8vw da capa — o ícone do
 * primeiro item nasce na coluna em que o título da capa nasce —, o ícone passou
 * a ficar **ao lado** do texto (em vez de acima), o texto é alinhado à esquerda
 * e o título é a display de 14px sobre o detalhe de 9px (era 12px em sans, em
 * caixa alta, sobre um texto centralizado).
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
      className="rv-section-bg-surface rv-benefits w-full"
    >
      <ul
        data-testid="benefits-bar"
        data-count={items.length}
        className="rv-benefits-row"
      >
        {items.map((item, index) => {
          const Icon = resolveIcon(item.icon)

          return (
            <li
              key={`${item.title}-${index}`}
              data-testid="benefit-item"
              className="rv-benefit"
            >
              <Icon
                className="rv-section-accent rv-benefit-icon"
                aria-hidden="true"
                focusable="false"
              />
              <span className="rv-benefit-copy">
                <p className="rv-benefit-title">{item.title}</p>
                {item.subtitle && (
                  <p className="rv-benefit-detail">{item.subtitle}</p>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
