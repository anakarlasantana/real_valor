/**
 * O índice das páginas declaradas — a régua aplicada, para as duas portas.
 * -------------------------------------------------------------------------
 * A F3a do doc 14 (item 2, o PR6) pedia a tela "Páginas" do CRM: as páginas que o
 * contrato declara, com o estado de cada uma e um atalho para os blocos dela. A
 * tela **não cria** página (é a entidade `content_page` da estratégia B, que segue
 * com gatilho) e **não publica** nenhuma: ela responde "o endereço responde?", que
 * é a pergunta que o lojista não tinha como fazer sem abrir as seis abas.
 *
 * O PR7 (a descoberta) mostrou que a mesma pergunta tem quatro consumidores do
 * lado da loja — o `sitemap`, a coluna automática do rodapé (`source: "pages"`), o
 * índice público (`/paginas`) e a sugestão do 404 —, e que todos querem a versão
 * curta dela: **quais** páginas estão no ar, e não o estado de cada uma. Daí as
 * duas leituras neste arquivo: `pageSummaries` (o índice do CRM, com as três
 * situações) e `livePages` (as que respondem 200, para a loja).
 *
 * A régua é a do contrato (`publishedSections` + `pageState`, em `contract.ts`),
 * e é a mesma que a rota `[slug]` do storefront aplica antes de responder 404:
 * habilitada **e** de um tipo que a loja desenha. Aqui ela só é **aplicada** —
 * porque a decisão de regra não pode ter dois textos.
 *
 * Fora das rotas (`api/admin/content/pages/route.ts` e
 * `api/store/content/pages/route.ts`) porque é a parte que não depende de
 * request: as duas contagens saem da lista que a rota leu. `readPageSections` é a
 * leitura que as duas portas fazem, e é a única função daqui que toca o serviço.
 */
import { PAGE_SURFACES, pageState, publishedSections } from "./contract"
import type { ContentSurfaceSpec, PageState } from "./contract"
import type ContentModuleService from "./service"

/**
 * O que o índice precisa saber de uma seção: se ela está ligada e de que tipo
 * ela é. É o mínimo que a régua lê — e é por isso que ele é um tipo próprio, e
 * não a linha inteira do banco.
 */
export type PageSectionRow = { type: string; enabled: boolean }

/** As seções de cada página declarada, por `id` de superfície. */
export type SectionsBySurface = Record<
  string,
  readonly PageSectionRow[] | undefined
>

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
  sectionsBySurface: SectionsBySurface,
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

/**
 * A página como a **loja** precisa dela: o `id` (que é o slug), o rótulo e o
 * endereço. Sem contagem, sem estado — quem lê isto só quer saber o que listar.
 */
export type LivePage = {
  id: string
  label: string
  path: string
}

/**
 * As páginas que estão **no ar** — as que a loja responde 200 —, para as pontas
 * que oferecem destino: a coluna do rodapé (`source: "pages"`), o índice público
 * e a sugestão do 404, além do `sitemap`.
 *
 * É a régua aplicada (`pageSummaries` + `state === "published"`), e é a mesma
 * que a rota `[slug]` usa para responder 404: uma página fora do ar **não**
 * aparece em lista nenhuma. Anunciar um 404 é o caminho mais curto para a busca
 * classificar o site como raso, e para a cliente clicar num resultado que não
 * abre (14.7, defeito 7).
 *
 * Quem **não** está no ar fica de fora em silêncio: é a diferença entre esta
 * função e o índice do CRM, que precisa mostrar as três situações.
 */
export function livePages(
  sectionsBySurface: SectionsBySurface,
  surfaces: readonly ContentSurfaceSpec[] = PAGE_SURFACES
): LivePage[] {
  return pageSummaries(sectionsBySurface, surfaces)
    .filter((page) => page.state === "published")
    .map((page) => ({ id: page.id, label: page.label, path: page.path }))
}

/**
 * Lê as seções de todas as páginas declaradas — a leitura que as **duas portas**
 * fazem antes de pedir o índice (a do CRM, `GET /admin/content/pages`, e a
 * pública, `GET /store/content/pages`).
 *
 * Uma consulta por página, e não uma consulta sem filtro: a leitura passa pela
 * fachada do módulo (`listSections`), que é onde o achatamento da linha mora, e
 * é a mesma que a aba de cada página usa — o índice e a tela de blocos não podem
 * discordar sobre o que a superfície tem.
 *
 * `onlyEnabled` é do chamador, e é a única coisa que muda entre as duas portas: o
 * CRM precisa das desabilitadas (a tela existe para mostrar o que está fora do
 * ar); a loja, não (conteúdo desabilitado não deve nem trafegar).
 */
export async function readPageSections(
  service: ContentModuleService,
  { onlyEnabled }: { onlyEnabled: boolean }
): Promise<SectionsBySurface> {
  const bySurface: Record<string, readonly PageSectionRow[]> = {}

  for (const surface of PAGE_SURFACES) {
    bySurface[surface.id] = await service.listSections({
      surface: surface.id,
      onlyEnabled,
    })
  }

  return bySurface
}
