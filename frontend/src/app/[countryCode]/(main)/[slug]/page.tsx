import { Metadata } from "next"
import { notFound } from "next/navigation"

import { findSurface } from "@lib/content/home-sections"
import { pageSeo } from "@lib/content/page-seo"
import { getPageSections } from "@lib/data/content"
import { getRegion } from "@lib/data/regions"
import { ContentSectionList } from "@modules/content/render-section"
import { HttpTypes } from "@medusajs/types"

/**
 * As páginas de conteúdo do CMS — `/br/sobre`, `/br/trocas-e-devolucoes`, ….
 * -------------------------------------------------------------------------
 * **Por que `[slug]` na raiz do `(main)`, e não `/pagina/[slug]`.** A URL de uma
 * página institucional é permanente: ela vai para o rodapé, para o e-mail, para
 * o Google e para a boca da cliente. `/sobre` é ditável no telefone;
 * `/pagina/trocas-e-devolucoes` não é. O preço dessa escolha é a colisão com uma
 * rota estática vizinha (`/rastreio`, `/store`…): o Next dá precedência à
 * estática, então uma página que colidisse **desapareceria em silêncio** — e é
 * por isso que existe um guarda em
 * `frontend/src/lib/content/page-surfaces.spec.ts`, que lista os diretórios de
 * `(main)/` e falha se um `id` de `PAGE_SURFACES` colidir com algum. A colisão é
 * erro de CI, não descoberta de sexta-feira.
 *
 * **O que esta rota recusa, e por quê.** Um `slug` que ninguém declarou no
 * contrato e uma página **sem bloco publicado** são os dois `notFound()` — cada
 * um fecha um defeito silencioso do doc 14:
 *
 *   1. `notFound()` no slug não declarado é o defeito "a página que não existe
 *      responde a home": `/br/troca-e-devolucao` (com o typo) mostraria a
 *      vitrine, e a visitante acharia que a loja não tem política de troca;
 *   2. `notFound()` na página vazia é o defeito "a página vazia vira a home": o
 *      fallback de `DEFAULT_HOME_SECTIONS` é da vitrine (`lib/data/content.ts`) e
 *      uma página que o herdasse publicaria a home sob a URL de `/privacidade`.
 *
 * **O que ela herda de graça** (14.8 do doc 14): o cabeçalho, a barra de anúncio
 * e o rodapé vêm do layout de `(main)`, o tema vem das CSS vars, e o embrulho de
 * âncora vem do registro de blocos. O que **não** se herda, e por isso está
 * escrito aqui: o `generateMetadata` (o título da página no Google), a decisão
 * de 404 e a busca de região.
 *
 * 60s, como a home: a edição no CRM aparece em até um minuto, e
 * `revalidateTag("content")` força antes. A janela é a mesma porque a leitura é
 * a mesma (`getSurfaceSections`) — só o `surface` muda.
 */
export const revalidate = 60

type Props = {
  params: Promise<{ countryCode: string; slug: string }>
}

/**
 * O `<title>` e a descrição, tirados do conteúdo — ver `lib/content/page-seo`.
 *
 * Sem isto a página nasceria com o título do layout ("Real Valor —
 * Alfaiataria Feminina"), e as seis páginas do CMS seriam **a mesma página** para
 * quem procura: três URLs com o mesmo título é o jeito mais barato de nenhuma ser
 * encontrada.
 *
 * A falha de rede aqui não é erro: `getPageSections` devolve vazio e o SEO cai no
 * nome da página (`surface.label`) — o `notFound()` de verdade é do componente,
 * que é quem responde pela página.
 */
export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params
  const surface = findSurface(slug)

  // Slug que ninguém declarou (ou uma superfície que não é página, como
  // `home`/`theme`): quem responde é o 404, e o metadata dele é o do layout.
  if (surface?.kind !== "page") {
    return {}
  }

  return pageSeo(await getPageSections(slug), surface.label)
}

export default async function ContentPage({ params }: Props) {
  const { countryCode, slug } = await params
  const surface = findSurface(slug)

  // A superfície tem de **existir** e ser uma página (`kind`, no contrato): é o
  // que impede `/br/theme` ou `/br/home` de desenharem conteúdo de outra ponta.
  if (surface?.kind !== "page") {
    notFound()
  }

  const sections = await getPageSections(slug)

  // Página sem bloco publicado responde 404 — nunca a home (critério 3 do doc
  // 14). É a diferença entre "esta página ainda não foi escrita" e "esta página
  // é a vitrine", e a segunda é mentira.
  if (!sections.length) {
    notFound()
  }

  // A região só serve aos blocos que mostram preço (`featured`, `launches`): sem
  // ela esses dois somem e a página fica de pé — o mesmo comportamento da home
  // (`renderSection`), que não deixa uma falha de catálogo derrubar a página.
  let region: HttpTypes.StoreRegion | null = null

  try {
    region = (await getRegion(countryCode)) ?? null
  } catch (error) {
    console.error("Falha ao carregar a região:", error)
  }

  return <ContentSectionList sections={sections} region={region} />
}
