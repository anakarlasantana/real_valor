/**
 * O carrossel da capa: quando ele anda sozinho, de quem é a vez e em que slide
 * ele está.
 * -------------------------------------------------------------------------
 * A capa com dois slides ou mais virou **ilha de cliente** (ver
 * `modules/home/components/hero/carousel.tsx`): o rodízio precisa de relógio e o
 * ponto aceso precisa de estado, e as duas coisas são de cliente. As decisões
 * que **não** são de componente moram aqui, longe do React, pelo mesmo motivo
 * que `ticker.ts` mora longe da barra de anúncio: são regra com caso de borda, e
 * se testam sem renderizar nada (`hero-carousel.spec.ts`).
 *
 *   1. **Quanto tempo cada slide fica.** Sete segundos: dá para ler o título e o
 *      subtítulo (a cópia da capa é uma frase, não um parágrafo) e ainda perceber
 *      que a foto trocou. Menos que isso a capa vira GIF; mais que isso o segundo
 *      slide quase não existe — quem percorre a home passa da dobra antes do
 *      rodízio fechar a volta. É **constante de código, e não campo do CRM**: o
 *      contrato só ganha campo quando o lojista tem o que decidir com ele, e
 *      "trocar mais devagar" ainda não foi pedido. Quando for, o número que ele
 *      herda é este.
 *
 *   2. **De quem é a vez.** O rodízio para por três motivos, e os três são o
 *      visitante pedindo: `prefers-reduced-motion` (movimento automático é
 *      exatamente o que a preferência desliga), o botão de pausa (a WCAG 2.2.2
 *      pede um mecanismo visível para parar o movimento) e o ponteiro, o foco ou
 *      a aba oculta — quem está lendo a cópia, ou navegando os pontos por Tab,
 *      não tem a foto fugindo por baixo do cursor. É a mesma regra do ticker, que
 *      pausa no `:hover` e no `:focus-within`.
 *
 *   3. **Em que slide ele está.** Com o trilho rolando, o slide atual é
 *      `scrollLeft / largura` arredondado e preso à lista. É essa conta que
 *      acende o ponto certo quando quem rola é o dedo, e não o relógio.
 */

/** Quantos segundos cada slide fica antes de o rodízio passar ao próximo. */
export const HERO_AUTOPLAY_SECONDS = 7

/**
 * Quanto se espera, depois de um `scrollTo`, para voltar a ler a rolagem como
 * navegação.
 *
 * O `scrollTo({ behavior: "smooth" })` leva algumas centenas de milissegundos, e
 * durante o percurso a posição do trilho passa pelos slides intermediários: ler
 * a rolagem nessa janela acenderia os pontos um a um (pisca-pisca de três slides
 * acendendo em sequência). Enquanto o nosso próprio `scrollTo` está em voo, o
 * `scroll` que ele dispara é consequência, não navegação — e esta é a janela em
 * que o componente ignora a rolagem. O número é folgado de propósito: passar
 * dele um pouco significa uma leitura a mais, e não um ponto errado.
 */
export const HERO_SCROLL_SETTLE_MS = 800

/**
 * O próximo slide, dando a volta no fim.
 *
 * Um slide só (ou lista vazia) devolve 0: não há próximo, e o `scrollTo` de um
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
  // e barata, e um índice fora da lista devolveria um slide inexistente.
  const from = Number.isFinite(current)
    ? ((Math.trunc(current) % total) + total) % total
    : 0

  return (from + 1) % total
}

/**
 * O slide que a rolagem está mostrando — arredondado e preso à lista.
 *
 * Largura zero é o trilho que ainda não foi medido (primeiro quadro, ou
 * `display: none`): sem ela a divisão seria `Infinity`, e o índice 0 é a
 * resposta honesta — o trilho está no começo.
 */
export function slideIndexFromScroll(
  scrollLeft: number,
  clientWidth: number,
  count: number
): number {
  if (!Number.isFinite(count) || count < 1) {
    return 0
  }

  const total = Math.trunc(count)

  if (
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(clientWidth) ||
    clientWidth <= 0
  ) {
    return 0
  }

  const index = Math.round(scrollLeft / clientWidth)

  return Math.min(Math.max(index, 0), total - 1)
}

/**
 * O rodízio deve estar andando?
 *
 * Cada motivo devolve `false` sozinho, e o motivo está no nome do parâmetro:
 * quem lê o componente não precisa adivinhar o que `held` quer dizer.
 */
export function shouldAutoplay({
  count,
  reducedMotion,
  paused,
  held,
}: {
  /** Quantos slides o carrossel tem. */
  count: number
  /** O visitante pediu menos movimento no sistema. */
  reducedMotion: boolean
  /** O visitante pausou no botão (ou retomou: `false`). */
  paused: boolean
  /** Ponteiro em cima, foco dentro ou aba oculta. */
  held: boolean
}): boolean {
  if (!Number.isFinite(count) || count < 2) {
    return false
  }

  return !reducedMotion && !paused && !held
}
