/**
 * O registro de blocos do site — a página monta a lista, e quem desenha é aqui.
 * -------------------------------------------------------------------------
 * Até a F1 do doc 14 este `switch` morava dentro da home
 * (`app/[countryCode]/(main)/page.tsx`). Agora existem **duas** superfícies que
 * desenham os mesmos blocos (a vitrine e cada página declarada, `PAGE_SURFACES`),
 * e um segundo `switch` copiado na rota `[slug]` seria a mesma lista de tipos
 * mantida em dois lugares — o defeito que este projeto mais paga, porque essa
 * lista não é conferida pelo compilador: um tipo renderizado só na home faria a
 * página que o usa cair no `assertNever` (HTTP 500 na página inteira) ou, pior,
 * aparecer em branco.
 *
 * O que mora aqui é só o que as duas pontas têm em comum: o mapeamento
 * `type` → componente e o embrulho de cada bloco. O que **não** mora aqui é
 * decisão de página — o `generateMetadata` da rota, o 404 de página vazia e a
 * busca de região continuam sendo de quem monta a página (14.8 do doc 14).
 *
 * ## O embrulho não é enfeite: é a âncora
 *
 * Cada bloco é desenhado dentro de um `<div>` com `id={section.id}` e a classe
 * `rv-anchor` — é esse `id` que o menu usa (`/#editorial` rola até a seção) e é o
 * `rv-anchor` (`brand.css`) que compensa o cabeçalho fixo. Até aqui o wrapper
 * estava escrito dentro da home, e uma rota nova que chamasse só o componente do
 * bloco perderia a âncora **em silêncio**: o menu continuaria funcionando na home
 * e passaria a não funcionar na página, sem nada quebrar. Por isso o wrapper vem
 * junto do registro (`ContentSectionList`) em vez de ficar a cargo de cada
 * página.
 *
 * O mesmo wrapper é quem carrega as variáveis de aparência do bloco
 * (`appearanceVars`): como todo bloco passa por aqui, um campo de aparência novo
 * não precisa ser ligado componente por componente — quem lê as variáveis são as
 * classes `.rv-section-*` do `brand.css`. Bloco sem nenhuma escolha sai com o
 * `style` vazio, ou seja, com o HTML de antes.
 */
import { appearanceVars } from "@lib/content/appearance"
import type { HomeSection } from "@lib/content/home-sections"
import Prose from "@modules/content/prose"
import BenefitsBar from "@modules/home/components/benefits-bar"
import CollectionHighlights from "@modules/home/components/collection-highlights"
import EditorialBanner from "@modules/home/components/editorial-banner"
import EditorialCallout from "@modules/home/components/editorial-callout"
import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import InstagramGrid from "@modules/home/components/instagram-grid"
import LaunchesRail from "@modules/home/components/launches-rail"
import { HttpTypes } from "@medusajs/types"
import { type ReactNode } from "react"

/**
 * O que um bloco precisa para ser desenhado.
 *
 * `region` existe porque três tipos precisam de preço (`hero`, `featured` e
 * `launches`), e ela vem de fora — quem sabe buscar a região é a página, que
 * também decide o que fazer quando ela falta. `selectedFilter` é da vitrine: o
 * `?peca=` da home filtra os destaques. Numa página chega `undefined`, e o
 * componente se comporta como o da home sem filtro nenhum.
 */
export type SectionContext = {
  region: HttpTypes.StoreRegion | null
  selectedFilter?: string
}

/**
 * O registro. Casar `section.type` dá exaustividade de verdade: `assertNever`
 * deixa de compilar se um membro for acrescentado ao `HomeSection` e não for
 * tratado aqui.
 *
 * `announcement`, `nav` e `footer` viajam no mesmo payload, mas não são blocos de
 * página: são o cromo do site, resolvido pelo layout (barra superior, cabeçalho
 * e rodapé) em **todas** as rotas. Por isso os três caem em `null` aqui —
 * devolvê-los duplicaria a barra e o cabeçalho no corpo da página. Numa página
 * eles nem chegam a existir: a API recusa criá-los fora da vitrine
 * (`resolveSurface`, no backend).
 *
 * Devolve `null` (em vez de JSX vazio) para o chamador distinguir "nada a
 * renderizar" de "bloco renderizado" e só embrulhar o segundo na âncora.
 */
export function renderSection(
  section: HomeSection,
  { region, selectedFilter }: SectionContext
): ReactNode {
  switch (section.type) {
    case "announcement":
      // Desenhado pelo layout como cromo do site; aqui seria a barra em dobro.
      return null
    case "nav":
      // Mesmo caso: o layout resolve o cabeçalho via `headerSections()`.
      return null
    case "footer":
      // E o rodapé, via `footerSections()`.
      return null
    case "hero":
      return <Hero section={section} />
    case "launches":
      // Como o `featured`: sem região não há preço, e um trilho de cards sem
      // preço é pior do que nenhum trilho. O bloco some, a página fica de pé.
      if (!region) {
        return null
      }
      return <LaunchesRail section={section} region={region} />
    case "benefits":
      return <BenefitsBar items={section.items} />
    case "collections":
      return <CollectionHighlights section={section} />
    case "featured":
      if (!region) {
        return null
      }
      return (
        <FeaturedProducts
          section={section}
          region={region}
          selectedFilter={selectedFilter}
        />
      )
    case "editorial":
      return <EditorialBanner section={section} />
    case "banner":
      // A faixa editorial: foto, cópia e um botão. Não depende de região nem de
      // catálogo, então nunca degrada por falta de dado.
      return <EditorialCallout section={section} />
    case "prose":
      // O texto longo: subtítulo, parágrafo e lista, com as marcas inline
      // interpretadas por `renderInline`. Também não depende de região nem de
      // catálogo — é o bloco das páginas institucionais (Privacidade, Termos,
      // Trocas), e por isso o único que não aparece na vitrine de fábrica.
      return <Prose section={section} />
    case "instagram":
      return <InstagramGrid section={section} />
    default:
      return assertNever(section)
  }
}
/**
 * Os blocos de uma superfície, na ordem em que chegaram (já ordenados por
 * `position` e sem os desabilitados — ver `visibleSections`).
 *
 * É o que a home e a rota `[slug]` desenham, e é o único lugar onde o embrulho
 * de âncora existe: uma ponta nova (o índice público da F3a, por exemplo) ganha
 * a âncora e a aparência de graça, em vez de reescrever o wrapper — que é
 * justamente o que a 14.8 do doc 14 avisa que não se herda sozinho.
 */
export function ContentSectionList({
  sections,
  region,
  selectedFilter,
}: SectionContext & { sections: HomeSection[] }): ReactNode {
  return (
    <>
      {sections.map((section) => {
        const body = renderSection(section, { region, selectedFilter })

        // Bloco sem corpo (o cromo do site, ou `featured` sem região) não vira
        // âncora vazia no meio da página.
        if (!body) {
          return null
        }

        // O `id` do bloco é a âncora — é ele que o menu do cabeçalho aponta
        // (`/#editorial`): sem o `id` no JSX, o link rola para o topo. O
        // `.rv-anchor` (`brand.css`) compensa o cabeçalho fixo, e o `style`
        // traz as variáveis de aparência (ver `appearanceVars`).
        return (
          <div
            key={section.id}
            id={section.id}
            className="rv-anchor rv-section"
            style={appearanceVars(section)}
          >
            {body}
          </div>
        )
      })}
    </>
  )
}

function assertNever(value: never): never {
  throw new Error(
    `Bloco de conteúdo não suportado: ${JSON.stringify(
      (value as { type?: string })?.type
    )}`
  )
}
