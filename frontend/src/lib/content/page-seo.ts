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
  FaqSection,
  HomeSection,
  ProseSection,
} from "@lib/content/home-sections"

import { plainText } from "./markdown"

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

/** Os quatro tipos que **abrem** uma página: os únicos com título próprio. */
type OpeningSection =
  | EditorialSection
  | BannerSection
  | ProseSection
  | FaqSection

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
  const opening = sections.find(isOpening)

  const title = opening ? openingTitle(opening) : ""
  const description = clamp(openingText(sections))

  return {
    title: title || fallbackTitle,
    ...(description ? { description } : {}),
  }
}

function isOpening(section: HomeSection): section is OpeningSection {
  return (
    section.type === "editorial" ||
    section.type === "banner" ||
    section.type === "prose" ||
    section.type === "faq"
  )
}

/**
 * O título com que cada tipo de abertura nomeia a página.
 *
 * `banner` e `editorial` desenham `title` e logo depois o `titleEmphasis` dentro
 * de um `<em>` (`editorial-banner`, `editorial-callout`) — no `<title>` não há
 * `<em>`, então os dois viram uma frase só, com um espaço. Sem juntar, o título
 * na busca sairia cortado na metade que dá o sentido ("A alfaiataria que").
 *
 * O `prose` e o `faq` são a exceção de propósito: os dois têm `title` e mais
 * nada — os subtítulos do `prose` são **blocos**, e as perguntas do `faq` são
 * itens da lista, não nomes de página. É o `title` da seção, e só ele, que nomeia
 * a página; sem título, o nome é o `label` da superfície.
 */
function openingTitle(section: OpeningSection): string {
  if (section.type === "prose" || section.type === "faq") {
    return text(section.title)
  }

  return joinTitle(text(section.title), text(section.titleEmphasis))
}

/** As duas linhas do título, juntas com um espaço — como o `<title>` as lê. */
function joinTitle(title: string, emphasis: string): string {
  return [title.trim(), emphasis.trim()].filter(Boolean).join(" ")
}

/**
 * O texto corrido de abertura — o que a busca mostra debaixo do título.
 *
 * É o `body` do `editorial` (o de sempre) ou o primeiro **parágrafo** do
 * `prose`, sem as marcas: `**Real Valor**` chegaria ao resultado da busca com os
 * asteriscos à vista. Quem tira as marcas é `plainText`, o mesmo parser que a
 * página usa para desenhá-las — não um `replace` de `*`/`_`, que no dia em que o
 * subconjunto mudasse passaria a divergir do render.
 *
 * Só o `paragraph` serve: um subtítulo é um rótulo de seção, e uma lista vira
 * itens sem contexto ("· o prazo é de 30 dias") — nenhum dos dois é uma frase.
 *
 * A resposta de uma pergunta frequente também **não** entra, e a ausência é
 * deliberada: a resposta responde a uma pergunta que a busca não fez, e fora do
 * par pergunta⇔resposta ela é uma frase solta sobre um assunto qualquer. Quando a
 * página do FAQ precisa de descrição, quem a dá é o `prose` de abertura — que é
 * o par natural dele na página.
 */
function openingText(sections: HomeSection[]): string {
  const editorial = sections.find(
    (section): section is EditorialSection => section.type === "editorial"
  )

  if (text(editorial?.body) !== "") {
    return text(editorial?.body)
  }

  const prose = sections.find(
    (section): section is ProseSection => section.type === "prose"
  )
  const paragraph = (prose?.blocks ?? []).find(
    (block) => block.kind === "paragraph" && text(block.text).trim() !== ""
  )

  return paragraph ? plainText(text(paragraph.text)) : ""
}

/** O texto de um campo que o banco guarda livre. */
function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * O texto do bloco numa linha só, no limite do que a busca mostra.
 *
 * Os dois cortes são de propósito: o `body` é um `textarea`, então vem com as
 * quebras que o lojista digitou (e uma descrição nunca é multilinha), e o
 * tamanho é o da vitrine da busca.
 */
function clamp(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim()

  return flat.length > SEO_DESCRIPTION_LIMIT
    ? `${flat.slice(0, SEO_DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : flat
}
