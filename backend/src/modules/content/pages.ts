/**
 * A tela "Páginas" do CRM — o índice das páginas declaradas.
 * -------------------------------------------------------------------------
 * A F3a do doc 14 (item 2): as páginas que o contrato declara, com o estado de
 * cada uma e um atalho para os blocos dela. A tela **não cria** página (é a
 * entidade `content_page` da estratégia B, que segue com gatilho) e **não
 * publica** nenhuma: ela responde "o endereço responde?", que é a pergunta que o
 * lojista não tinha como fazer sem abrir as seis abas.
 *
 * A régua é a do contrato (`publishedSections` + `pageState`, em `contract.ts`),
 * e é a mesma que a rota `[slug]` do storefront aplica antes de responder 404:
 * habilitada **e** de um tipo que a loja desenha. Aqui ela só é **aplicada** —
 * uma linha por superfície declarada —, porque a decisão de regra não pode ter
 * dois textos.
 *
 * Fica fora da rota (`api/admin/content/pages/route.ts`) porque é a parte pura:
 * recebe as seções por superfície e devolve as linhas. O teste da régua e o do
 * índice não precisam de request, container nem banco — as duas contagens saem
 * da lista que a rota já leu.
 */
import { PAGE_SURFACES, pageState, publishedSections } from "./contract"
import type { ContentSurfaceSpec, PageState } from "./contract"

/** Uma linha da tela "Páginas": a página e o que ela está mostrando hoje. */
export type PageSummary = {
  id: string
  label: string
  /**
   * O endereço da página — o `id` dela, que o contrato declara slug, **sem** o
   * país: quem prefixa é a loja. É o mesmo par que o seletor de destino do CRM
   * já oferece (`CONTENT_DESTINATIONS`), e vem daqui pronto para a tela não ter
   * de montar caminho.
   */
  path: string
  /** Quantos blocos a página tem — publicados ou não. */
  blocks: number
  /** Quantos desses a loja desenha (a régua, ver `publishedSections`). */
  published: number
  state: PageState
}

/**
 * As linhas do índice, uma por página declarada.
 *
 * `sectionsBySurface` é o que a rota leu: as seções **cruas** de cada
 * superfície, desabilitadas inclusive (é o `onlyEnabled: false` de
 * `GET /admin/content`, pelo mesmo motivo — o índice mostra o que está fora do
 * ar). Superfície sem entrada nenhuma vira a linha "sem blocos", e não some da
 * lista: uma página declarada que não aparece é uma página que o lojista não
 * sabe que existe.
 *
 * As superfícies entram como parâmetro (padrão: `PAGE_SURFACES`) para o teste
 * poder exercitar uma página nova sem tocar no contrato — a mesma porta que
 * `resolveSurface` abriu.
 */
export function pageSummaries(
  sectionsBySurface: Record<
    string,
    readonly { type: string; enabled: boolean }[] | undefined
  >,
  surfaces: readonly ContentSurfaceSpec[] = PAGE_SURFACES
): PageSummary[] {
  return surfaces.map((surface) => {
    const sections = sectionsBySurface[surface.id] ?? []

    return {
      id: surface.id,
      label: surface.label,
      path: `/${surface.id}`,
      blocks: sections.length,
      published: publishedSections(sections).length,
      state: pageState(sections),
    }
  })
}
