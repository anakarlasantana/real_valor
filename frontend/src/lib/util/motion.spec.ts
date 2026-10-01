/**
 * O compasso da vitrine e quem pode pulsar.
 * -------------------------------------------------------------------------
 * São funções de duas linhas, e o teste existe pelo que elas **decidem**, não
 * pelo que calculam:
 *
 *   - o atraso da entrada é limitado: a décima peça de uma vitrine grande entra
 *     no mesmo compasso da quinta, e não um segundo depois — o card que chega
 *     depois do dedo é pior que card nenhum animado;
 *   - o primeiro card não espera;
 *   - e "sob demanda"/"esgotado" não pulsam. É a decisão de hierarquia do
 *     `brand.css` escrita onde ela é testável: só dois dos quatro estados se
 *     mexem, e são os dois que falam de disponibilidade.
 */
import { describe, expect, it } from "vitest"

import {
  MOTION_STAGGER_MAX_STEPS,
  MOTION_STAGGER_MS,
  pulses,
  revealDelay,
  staggerMs,
} from "./motion"

describe("staggerMs", () => {
  it("um passo é o compasso", () => {
    expect(staggerMs(1)).toBe(MOTION_STAGGER_MS)
    expect(staggerMs(3)).toBe(3 * MOTION_STAGGER_MS)
  })

  it("passo zero, negativo ou que não é número é atraso nenhum", () => {
    expect(staggerMs(0)).toBe(0)
    expect(staggerMs(-2)).toBe(0)
    expect(staggerMs(Number.NaN)).toBe(0)
  })
})

describe("revealDelay", () => {
  it("o primeiro card não espera", () => {
    expect(revealDelay(0)).toBe(0)
  })

  it("os outros entram um atrás do outro", () => {
    expect(revealDelay(1)).toBe(MOTION_STAGGER_MS)
    expect(revealDelay(3)).toBe(3 * MOTION_STAGGER_MS)
  })

  it("do quinto em diante, todo mundo entra junto", () => {
    expect(revealDelay(MOTION_STAGGER_MAX_STEPS)).toBe(
      MOTION_STAGGER_MAX_STEPS * MOTION_STAGGER_MS
    )
    expect(revealDelay(12)).toBe(
      MOTION_STAGGER_MAX_STEPS * MOTION_STAGGER_MS
    )
  })

  it("índice fora da lista é atraso nenhum", () => {
    expect(revealDelay(-1)).toBe(0)
    expect(revealDelay(Number.NaN)).toBe(0)
  })

  it("o atraso nunca passa de meio segundo (o card não chega depois do dedo)", () => {
    expect(revealDelay(999)).toBeLessThan(500)
  })
})

describe("pulses", () => {
  it("os dois estados de disponibilidade se mexem", () => {
    expect(pulses("pronta-entrega")).toBe(true)
    expect(pulses("ultimas")).toBe(true)
  })

  it("o que a pessoa não pode comprar agora fica parado", () => {
    expect(pulses("sob-demanda")).toBe(false)
    expect(pulses("esgotado")).toBe(false)
  })
})
