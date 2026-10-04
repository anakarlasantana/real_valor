/**
 * O movimento da vitrine — o compasso da entrada e quem pode respirar.
 * -------------------------------------------------------------------------
 * Duas decisões que a vitrine inteira compartilha, e que por isso não podem
 * morar dentro de um componente:
 *
 *   1. **O compasso da entrada em cena.** Os cards de uma seção entram um atrás
 *      do outro, e o atraso entre eles é este número — o mesmo em "Destaques", em
 *      "Lançamentos" e no que vier. Setenta milissegundos: o olho lê a seção como
 *      uma coisa só chegando, e não como cinco animações separadas. A partir de
 *      umas dez peças o atraso acumulado passaria de um segundo, e o último card
 *      chegaria depois do dedo que rolou até ele — por isso o compasso para
 *      depois de quatro passos.
 *   2. **Quem pode se mexer sozinho.** O chip de estado é o único elemento da
 *      loja que se anima sem ninguém pedir, e aqui mexer é sinal: "pronta
 *      entrega" **respira** (a peça está aqui) e "últimas peças" **pulsa** (o
 *      estoque acaba). "Sob demanda" e "esgotado" ficam parados — um chip que
 *      pulsa dizendo que a peça não está pronta é ruído, e a hierarquia do
 *      `brand.css` põe o esgotado como o mais quieto da lista.
 *
 * As durações e as curvas são **tokens de CSS** (`--rv-motion-*` e `--rv-ease-*`,
 * em `brand.css`): o que é decisão de desenho fica no desenho. O que é decisão de
 * comportamento — em que ordem, e se — fica aqui, com teste (`motion.spec.ts`).
 *
 * **Nada aqui devolve duração.** Quem desenha a animação é o CSS, e quem atende
 * `prefers-reduced-motion` é a guarda global do fim do `brand.css`, que zera
 * toda animação e transição da loja — inclusive as do chip, que terminam no
 * estado parado em vez de congelar a meio caminho.
 */
import { type ProductStatus } from "./product-availability"

/** O atraso entre um card e o seguinte na entrada da seção, em ms. */
export const MOTION_STAGGER_MS = 70

/** Depois deste passo, todo mundo entra junto (ver o compasso, acima). */
export const MOTION_STAGGER_MAX_STEPS = 4

/**
 * O atraso de um passo do compasso.
 *
 * Passo que não é número, ou negativo, é atraso nenhum: a função serve ao índice
 * da lista, e uma lista não tem passo -1 nem `NaN`.
 */
export function staggerMs(step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return 0
  }

  return Math.trunc(step) * MOTION_STAGGER_MS
}

/**
 * O atraso da entrada do card de índice `index`.
 *
 * O primeiro card não espera (`0ms`): a seção começa a aparecer no mesmo quadro
 * em que ela chega à tela, e o atraso é dos outros, um a um.
 */
export function revealDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) {
    return 0
  }

  return staggerMs(Math.min(Math.trunc(index), MOTION_STAGGER_MAX_STEPS))
}

/**
 * O chip deste estado se mexe?
 *
 * **Só "últimas peças".** Eram dois, e a loja pediu um: numa vitrine em que
 * toda peça com estoque tem o chip pulsando, o movimento deixa de ser
 * informação e vira ruído — e o browser mostra dez peças pulsando ao mesmo
 * tempo na dobra.
 *
 * "Últimas peças" é o único estado em que o movimento carrega algo que o
 * texto não carrega: acaba. "Pronta entrega" não precisa de animação para
 * dizer que a peça está disponível, e "esgotado" **jamais** deveria piscar —
 * um chip pedindo atenção numa peça que não pode ser comprada é o oposto de
 * honesto.
 *
 * O movimento em si é lento e contínuo (nada de piscar rápido): ver
 * `rv-chip-pulse` no `brand.css`, e a regra da WCAG 2.3.1 dita no comentário
 * de lá.
 */
export function pulses(status: ProductStatus): boolean {
  return status === "ultimas"
}
