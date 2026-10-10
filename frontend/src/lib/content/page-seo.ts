/**
 * O SEO de uma página de conteúdo, tirado do próprio conteúdo.
 * -------------------------------------------------------------------------
 * Por que isto existe: o `<title>` de uma página que ninguém declarou é o do
 * layout (`%s | Real Valor`, com o default da marca), então `/sobre`,
 * `/trocas-e-devolucoes` e `/privacidade` nasceriam **todas com o mesmo título
 * no Google** — e três URLs diferentes com o mesmo título é o jeito mais barato
 * de nenhuma ser encontrada. É o defeito 7 do doc 14.
 *
 * Mora num arquivo próprio porque é decisão pura e testável (recebe blocos,
 * devolve strings): o `generateMetadata` da rota só a chama. E é por ser pura
 * que "o título vem do conteúdo" é verificável sem navegador — num teste, e não
 * num `curl` contra a loja de pé.
 */
import type {
  BannerSection,
  EditorialSection,
  HomeSection,
} from "@lib/content/home-sections"

export type PageSeo = {
  /** Vai cru para o `<title>`: quem assina a marca é o template do layout. */
  title: string
  /**
   * Ausente quando nenhum bloco tem texto de abertura.
   *
   * Melhor ausente do que genérica: uma descrição igual ao título de todas as
   * páginas é ruído que a busca ignora, e o `<meta>` que não existe deixa o
   * layout falar — que é o que o site fazia antes de haver página.
   */
  description?: string
}

/**
 * O corte da descrição — o mesmo que os buscadores usam para montar o trecho
 * (o Google mostra por volta de 155 a 160 caracteres). Passar disso não é erro,
 * é texto que ninguém lê.
 */
export const SEO_DESCRIPTION_LIMIT = 160

/** Os dois tipos que **abrem** uma página: os únicos com `title` + ênfase. */
type OpeningSection = EditorialSection | BannerSection

/**
 * O título e a descrição de uma página.
 *
 * `fallbackTitle` é o `label` da superfície (o nome da página no CRM, "Sobre"):
 * uma página cujo primeiro bloco ainda não tem título aparece na busca pelo
 * nome dela, e não pelo nome da loja — que é o starter falando por uma página
 * que já existe.
 */
export function pageSeo(
  sections: HomeSection[],
  fallbackTitle: string
): PageSeo {
  // O primeiro bloco **na ordem da página** (elas chegam ordenadas): o bloco de
  // abertura é o que a visitante lê primeiro, e é ele que nomeia a página.
  const opening = sections.find(
    (section): section is OpeningSection =>
      section.type === "editorial" || section.type === "banner"
  )
  const text = sections.find(
    (section): section is EditorialSection => section.type === "editorial"
  )

  const title = joinTitle(opening?.title, opening?.titleEmphasis)
  const description = clamp(text?.body)

  return {
    title: title || fallbackTitle,
    ...(description ? { description } : {}),
  }
}

/**
 * O título com a ênfase, do jeito que o render o escreve.
 *
 * `banner` e `editorial` desenham `title` e logo depois o `titleEmphasis` dentro
 * de um `<em>` (`editorial-banner`, `editorial-callout`) — no `<title>` não há
 * `<em>`, então os dois viram uma frase só, com um espaço. Sem juntar, o título
 * na busca sairia cortado na metade que dá o sentido ("A alfaiataria que").
 */
function joinTitle(title: unknown, emphasis: unknown): string {
  const head = typeof title === "string" ? title.trim() : ""
  const tail = typeof emphasis === "string" ? emphasis.trim() : ""

  return [head, tail].filter(Boolean).join(" ")
}

/**
 * O texto do bloco numa linha só, no limite do que a busca mostra.
 *
 * Os dois cortes são de propósito: o `body` é um `textarea`, então vem com as
 * quebras que o lojista digitou (e uma descrição nunca é multilinha), e o
 * tamanho é o da vitrine da busca.
 */
function clamp(text: unknown): string {
  const flat = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : ""

  return flat.length > SEO_DESCRIPTION_LIMIT
    ? `${flat.slice(0, SEO_DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : flat
}
