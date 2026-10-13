/**
 * O carrossel de produtos — a conta que todo carrossel da loja precisa.
 * -------------------------------------------------------------------------
 * "Lançamentos" e "Peças em destaque" mostram a mesma coisa: uma fila de cards
 * que rola, com setas, pontos, e que anda sozinha quando ninguém está mexendo.
 * As decisões que dão para testar sem renderizar nada moram aqui:
 *
 *   1. **Quantos cards cabem na largura visível** (`itemsPerView`) — medido no
 *      DOM, e não adivinhado por faixa de tela: quem manda na largura do card é
 *      o CSS (`.rv-carousel-item`, em `brand.css`), e o componente só lê o
 *      resultado. Uma tabela de larguras em JavaScript duplicaria a régua e
 *      discordaria dela no dia em que o desenho mudasse.
 *   2. **Quantas páginas isso dá** (`pagesOf`) — a página é uma *tela cheia de
 *      cards*, não um card: com dois por tela e três peças, o carrossel tem duas
 *      páginas e a segunda começa na segunda peça.
 *   3. **Em que página a rolagem está** (`pageIndexFromScroll`) — é essa conta
 *      que acende o ponto certo quando quem rola é o dedo, e não o relógio.
 *   4. **De quem é a vez de andar** (`shouldAutoplay`) — menos movimento no
 *      sistema, ponteiro em cima, foco do teclado, aba oculta, fora da tela, ou
 *      o visitante já tendo assumido o volante: cada motivo devolve `false`
 *      sozinho, e o motivo está no nome do parâmetro.
 *   5. **Qual é a próxima** (`nextIndex`) — dando a volta no fim.
 *
 * O que sobra é React, e mora nos componentes:
 * `modules/home/components/product-carousel/index.tsx` (as duas seções de
 * vitrine) e `modules/home/components/hero/carousel.tsx` (a capa).
 *
 * **A capa é o caso particular em que cada página é um slide.** Ela usava um
 * arquivo próprio (`hero-carousel.ts`) com as mesmas funções, porque era a única
 * ilha de carrossel da loja; com a segunda, a conta virou esta e a capa passou a
 * importar daqui — duas cópias de `nextIndex` divergiriam no primeiro ajuste
 * feito em uma só.
 */

/**
 * Quantos segundos cada página fica antes de o rodízio passar à próxima.
 *
 * Seis: dá para ler o título e o preço de dois cards e perceber que a fila
 * andou, e não é tanto que a última página quase não apareça. É **constante de
 * código, e não campo do CRM** — o contrato só ganha campo quando o lojista tem
 * o que decidir com ele, e "trocar mais devagar" ainda não foi pedido. Quando
 * for, o número que ele herda é este.
 */
export const CAROUSEL_AUTOPLAY_SECONDS = 6

/**
 * Quanto se espera, depois de um `scrollTo`, para voltar a ler a rolagem como
 * navegação.
 *
 * O `scrollTo({ behavior: "smooth" })` leva algumas centenas de milissegundos, e
 * durante o percurso a posição do trilho passa pelas páginas intermediárias: ler
 * a rolagem nessa janela acenderia os pontos um a um (pisca-pisca de três pontos
 * acendendo em sequência) e, na vitrine, ainda marcaria o carrossel como
 * "assumido pelo visitante" — o que pararia o rodízio no primeiro passo dele.
 * Enquanto o nosso próprio `scrollTo` está em voo, o `scroll` que ele dispara é
 * consequência, não navegação — e esta é a janela em que o componente ignora a
 * rolagem. O número é folgado de propósito: passar dele um pouco significa uma
 * leitura a mais, e não um ponto errado.
 */
export const CAROUSEL_SCROLL_SETTLE_MS = 800

/**
 * Quanto o trilho pode estar do fim e ainda ser "o fim".
 *
 * O `scrollLeft` máximo é arredondado pelo navegador, e a última página pode
 * parar um ou dois pixels antes dele; sem esta folga, chegar ao fim do trilho
 * não acenderia o último ponto.
 */
const END_TOLERANCE_PX = 2

/**
 * Quantos cards cabem na largura visível do trilho.
 *
 * A conta é a da régua: quantas vezes o par (card + vão) cabe na largura da
 * tela, contado o vão que **não** existe depois do último card. O resultado é
 * fracionário de propósito — com o card de 40% do tablet cabem **2,48**: dois
 * cards inteiros e quase metade do terceiro atravessando a borda, e é essa
 * fração que diz que a terceira peça precisa de uma segunda página. No celular,
 * com 1,29 card, ela precisa de uma terceira; no desktop, com 3,29, ela já está
 * na primeira — e é a mesma conta que devolve "não há página para trocar".
 *
 * O arredondamento na terceira casa existe para o ruído do pixel: dois cards de
 * 50% medidos a menos de um milésimo de pixel dariam 1,99999 e uma página a mais
 * num carrossel que não tem para onde rolar.
 */
export function itemsPerView(
  trackWidth: number,
  itemWidth: number,
  gap: number
): number {
  if (
    !Number.isFinite(trackWidth) ||
    !Number.isFinite(itemWidth) ||
    trackWidth <= 0 ||
    itemWidth <= 0
  ) {
    // Trilho ainda não medido (primeiro quadro, `display: none`) ou card sem
    // largura: um por tela é a resposta que não inventa página.
    return 1
  }

  const spacing = Number.isFinite(gap) && gap > 0 ? gap : 0
  const view = (trackWidth + spacing) / (itemWidth + spacing)

  return Math.max(1, Math.round(view * 1000) / 1000)
}

/**
 * Quantas páginas um carrossel de `count` cards tem, com `perView` por tela.
 *
 * Arredonda para cima: 3 cards em 2 por tela são duas páginas, e a sobra de uma
 * peça na segunda é a última página — não uma terceira tela com um card sozinho
 * à esquerda e o resto vazio.
 *
 * Lista vazia devolve 1 e não 0: a página 0 existe sempre, e um `0` por aqui
 * viraria divisão por zero em quem calcula o destino do `scrollTo`.
 */
export function pagesOf(count: number, perView: number): number {
  if (!Number.isFinite(count) || count < 1) {
    return 1
  }

  const view = Number.isFinite(perView) && perView > 0 ? perView : 1

  return Math.max(1, Math.ceil(Math.trunc(count) / view))
}

/**
 * A página que a rolagem está mostrando.
 *
 * A conta é "quantas telas o trilho andou", arredondada — e não a fração usada
 * como índice, que acenderia o ponto 0,5 no meio da transição. Com card de
 * esguelha (o caso do celular) o último ponto só acenderia com uma rolagem que
 * não existe, porque a última peça nunca encosta na esquerda: por isso o fim do
 * trilho é resposta direta, e não conta.
 *
 * `scrollWidth` é a largura do conteúdo (revela o quanto ainda dá para rolar) e
 * `clientWidth`, a da janela: a diferença entre as duas é o fim do trilho.
 */
export function pageIndexFromScroll({
  scrollLeft,
  clientWidth,
  scrollWidth,
  pageCount,
}: {
  /** O quanto o trilho já rolou. */
  scrollLeft: number
  /** A largura visível do trilho. */
  clientWidth: number
  /** A largura total do conteúdo do trilho. */
  scrollWidth: number
  /** Quantas páginas o carrossel tem (ver `pagesOf`). */
  pageCount: number
}): number {
  if (!Number.isFinite(pageCount) || pageCount < 2) {
    return 0
  }

  const pages = Math.trunc(pageCount)

  if (
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(clientWidth) ||
    clientWidth <= 0
  ) {
    // Trilho que ainda não foi medido: sem largura a divisão seria `Infinity`,
    // e o índice 0 é a resposta honesta — o trilho está no começo.
    return 0
  }

  const max = Number.isFinite(scrollWidth) ? scrollWidth - clientWidth : 0

  if (max > END_TOLERANCE_PX && scrollLeft >= max - END_TOLERANCE_PX) {
    return pages - 1
  }

  const index = Math.round(scrollLeft / clientWidth)

  return Math.min(Math.max(index, 0), pages - 1)
}

/**
 * A próxima página, dando a volta no fim.
 *
 * Uma página só (ou lista vazia) devolve 0: não há próxima, e o `scrollTo` de um
 * destino que não existe seria uma rolagem para lugar nenhum.
 */
export function nextIndex(current: number, count: number): number {
  if (!Number.isFinite(count)) {
    return 0
  }

  const total = Math.trunc(count)

  if (total < 2) {
    return 0
  }

  // Índice não inteiro ou negativo não vem do componente — mas a função é pura
  // e barata, e um índice fora da lista devolveria uma página inexistente.
  const from = Number.isFinite(current)
    ? ((Math.trunc(current) % total) + total) % total
    : 0

  return (from + 1) % total
}

/**
 * O rodízio deve estar andando?
 *
 * Cada motivo devolve `false` sozinho, e o motivo está no nome do parâmetro:
 * quem lê o componente não precisa adivinhar o que `held` quer dizer.
 *
 * `stopped` é o único que não volta atrás: os outros são o visitante *enquanto*
 * está lá (ponteiro em cima, foco, aba oculta) e passam quando ele sai; este é
 * quem assumiu o volante no primeiro gesto de navegação — seta, ponto ou
 * arrasto —, e a fila não volta a andar sozinha. É o que fecha a WCAG 2.2.2 sem
 * um botão de pausa na moldura: pausar no ponteiro não atende quem navega por
 * teclado, e parar de vez no primeiro gesto atende a todos.
 */
export function shouldAutoplay({
  pageCount,
  reducedMotion,
  held,
  stopped,
  onScreen,
}: {
  /** Quantas páginas o carrossel tem (uma só não tem o que rodar). */
  pageCount: number
  /** O visitante pediu menos movimento no sistema. */
  reducedMotion: boolean
  /** Ponteiro em cima, foco dentro ou aba oculta. */
  held: boolean
  /** O visitante já navegou à mão: a fila não volta a andar sozinha. */
  stopped: boolean
  /** O carrossel está visível na tela. */
  onScreen: boolean
}): boolean {
  if (!Number.isFinite(pageCount) || pageCount < 2) {
    return false
  }

  return !reducedMotion && !held && !stopped && onScreen
}
