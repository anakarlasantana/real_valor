/**
 * O tamanho do trilho de lançamentos.
 * -------------------------------------------------------------------------
 * O que este teste protege é a diferença entre **ausência de informação** e
 * **pedido fora da faixa**. Os dois casos são de uma linha e os dois erram
 * feio na tela:
 *
 *   - `limit: 0` (ou uma string vazia vinda de campo limpo no CRM) desenharia
 *     uma seção vazia — a seção existe justamente para mostrar peça;
 *   - `limit: 500` mandaria o catálogo inteiro pela rede, e o navegador
 *     esconderia 490 cards com CSS;
 *   - e um valor ausente **não** pode virar "sem limite": `listProducts` sem
 *     `limit` aplica um padrão próprio (12), que é um número escondido no SDK.
 *
 * A faixa é espelho do contrato (`SECTION_FIELDS.launches`), e o espelho é
 * conferido por `scripts/check-contract-parity.mjs` — aqui se testa o
 * comportamento da função, não o número.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `media.spec.ts`).
import { describe, expect, it } from "vitest"

import {
  LAUNCHES_LIMIT_FALLBACK,
  LAUNCHES_LIMIT_MAX,
  LAUNCHES_LIMIT_MIN,
  launchesLimit,
} from "./launches"

describe("launchesLimit", () => {
  it("valor dentro da faixa passa igual", () => {
    expect(launchesLimit(6)).toBe(6)
  })

  it("valor ausente cai no padrão da seção (e não em \"sem limite\")", () => {
    expect(launchesLimit(undefined)).toBe(LAUNCHES_LIMIT_FALLBACK)
    expect(launchesLimit(null)).toBe(LAUNCHES_LIMIT_FALLBACK)
    expect(launchesLimit("")).toBe(LAUNCHES_LIMIT_FALLBACK)
  })

  it("zero e negativo sobem para o piso (seção vazia não é seção)", () => {
    expect(launchesLimit(0)).toBe(LAUNCHES_LIMIT_MIN)
    expect(launchesLimit(-4)).toBe(LAUNCHES_LIMIT_MIN)
  })

  it("número grande desce para o teto (não manda o catálogo inteiro)", () => {
    expect(launchesLimit(500)).toBe(LAUNCHES_LIMIT_MAX)
  })

  it("número não finito é ausência, não pedido de catálogo inteiro", () => {
    expect(launchesLimit(Number.NaN)).toBe(LAUNCHES_LIMIT_FALLBACK)
    expect(launchesLimit(Number.POSITIVE_INFINITY)).toBe(
      LAUNCHES_LIMIT_FALLBACK
    )
  })

  it("string numérica vale como número (o `data` do bloco é JSON)", () => {
    expect(launchesLimit("6")).toBe(6)
  })

  it("texto que não é número cai no padrão", () => {
    expect(launchesLimit("oito")).toBe(LAUNCHES_LIMIT_FALLBACK)
  })

  it("fração é contagem de cards: arredonda para baixo", () => {
    expect(launchesLimit(6.9)).toBe(6)
  })
})
