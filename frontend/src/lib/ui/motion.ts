/**
 * O movimento da vitrine — o compasso da entrada e quem pode respirar.
 *
 * 1. **O compasso:** os cards entram um atrás do outro, e o atraso entre eles é
 *    este número, o mesmo em toda seção — setenta milissegundos fazem o olho ler a
 *    seção como uma coisa só chegando. A partir de umas dez peças o atraso
 *    acumulado passaria de um segundo e o último card chegaria depois do dedo que
 *    rolou até ele: por isso o compasso para.
 * 2. **Quem se mexe sozinho:** o chip de estado, e só o de "últimas peças" — o
 *    estoque acaba. "Pronta entrega" respirando em dez peças na dobra vira ruído, e
 *    "esgotado" piscando é o oposto de honesto.
 *
 * As durações e as curvas são **tokens de CSS** (`--rv-motion-*`, `--rv-ease-*`): o
 * desenho fica no desenho e o comportamento — em que ordem, e se — fica aqui, com
 * teste. **Nada aqui devolve duração:** quem atende `prefers-reduced-motion` é a
 * guarda global do fim do `brand.css`, que zera animação e transição da loja.
 */
import { type ProductStatus } from "@lib/catalog/product-availability"

/** O atraso entre um card e o seguinte na entrada da seção, em ms. */
export const MOTION_STAGGER_MS = 70

/** Depois deste passo, todo mundo entra junto (ver o compasso, acima). */
export const MOTION_STAGGER_MAX_STEPS = 4

/**
 * O atraso de um passo do compasso. Passo que não é número, ou negativo, é atraso
 * nenhum: uma lista não tem passo -1 nem `NaN`.
 */
export function staggerMs(step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return 0
  }

  return Math.trunc(step) * MOTION_STAGGER_MS
}

/**
 * O atraso da entrada do card de índice `index`. O primeiro não espera (`0ms`): a
 * seção começa a aparecer no mesmo quadro em que chega à tela.
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
 * **Só "últimas peças"** — o único estado em que o movimento carrega algo que o
 * texto não carrega: acaba. O movimento é lento e contínuo: ver `rv-chip-pulse` no
 * `brand.css` e a regra da WCAG 2.3.1 dita lá.
 */
export function pulses(status: ProductStatus): boolean {
  return status === "ultimas"
}
