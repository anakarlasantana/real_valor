import { type AbaDeCategoria } from "@lib/util/category-tabs"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * As abas de categoria do catálogo — "Todas", "Vestidos", "Blusas & Camisas"…
 *
 * Elas **são links**, e não um filtro: cada aba é a página da categoria, com o
 * endereço que ela sempre teve (`/categories/<handle>`). Foi assim que o
 * redesenho as desenhou (botões de texto, o ativo com o traço embaixo), mas a
 * decisão de elas serem navegação — e não estado de cliente — é o que as torna
 * compartilháveis, indexáveis e alcançáveis sem JavaScript. Um filtro de
 * categoria por URL faria a mesma tela com dois endereços diferentes.
 *
 * A lista (`../lib/util/category-tabs.ts`) é montada por quem chama, porque é a
 * rota que sabe se a página atual é uma categoria e quais filhas ela tem. Aqui só
 * se desenha: a aba ativa é a que tem o `handle` corrente, e nenhuma outra.
 */
export default function CategoryTabs({
  items,
  activeHandle,
}: {
  items: AbaDeCategoria[]
  activeHandle?: string
}) {
  if (items.length < 2) {
    return null
  }

  return (
    <nav
      className="rv-category-tabs"
      aria-label="Categorias"
      data-testid="category-tabs"
    >
      {/*
        A fileira dentro do trilho da loja: a faixa é inteira (fundo elevado, de
        ponta a ponta) e o conteúdo para onde o resto da página para. No celular
        a fileira começa à esquerda — com `justify-center`, a primeira aba sai da
        área visível quando a fileira rola, e uma aba que não se alcança é pior do
        que uma aba desalinhada.
      */}
      <div className="rv-container flex items-center justify-start gap-x-8 small:justify-center small:gap-x-12">
        {items.map((item) => {
          const ativa = (item.handle ?? "") === (activeHandle ?? "")

          return (
            <LocalizedClientLink
              key={item.href}
              href={item.href}
              className={`rv-btn rv-btn-text${ativa ? " active" : ""}`}
              aria-current={ativa ? "page" : undefined}
            >
              {item.label}
            </LocalizedClientLink>
          )
        })}
      </div>
    </nav>
  )
}
