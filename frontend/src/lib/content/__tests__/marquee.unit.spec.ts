/**
 * A faixa do Instagram.
 * -------------------------------------------------------------------------
 * O que este teste protege são as três contas que o CSS **não** pode fazer — e as
 * três erram para um defeito que aparece na tela sem erro nenhum:
 *
 *   - a volta mais estreita que a tela: a faixa entra em branco pela borda antes
 *     de a cópia chegar, uma vez por volta (o buraco à vista);
 *   - a velocidade fora da faixa: 0 atravessa a tela como um borrão, e um valor
 *     ausente animando "sem limite" é o mesmo borrão por outro caminho;
 *   - o arrasto fora de escala: a faixa que anda mais (ou menos) que o dedo, e o
 *     `NaN` que o navegador **ignora em silêncio** num `animation-delay` — a
 *     faixa que para de responder ao ponteiro sem erro nenhum no console.
 *
 * A faixa e o padrão são espelho do contrato (`SECTION_FIELDS.instagram` e o
 * `secondsPerImage` do conteúdo padrão), e o espelho é conferido **aqui**: o
 * último `describe` compara os três números com o dado do contrato. É o mesmo
 * arranjo de `ticker.unit.spec.ts` e `launches.unit.spec.ts`.
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `ticker.unit.spec.ts`).
import { describe, expect, it } from "vitest"

import { DEFAULT_HOME_SECTIONS, SECTION_FIELDS } from "@rv/contrato"

import {
  INSTAGRAM_SPEED_DEFAULT,
  INSTAGRAM_SPEED_MAX,
  INSTAGRAM_SPEED_MIN,
  MARQUEE_MIN_TILES,
  instagramSecondsPerImage,
  marqueeCopies,
  marqueeSeconds,
  marqueeSeekOffset,
} from "../marquee"

describe("marqueeCopies", () => {
  it("com uma imagem não há laço (a seção desenha a grade parada)", () => {
    expect(marqueeCopies(0)).toBe(1)
    expect(marqueeCopies(1)).toBe(1)
  })

  it("a lista se repete até a volta passar da largura da tela", () => {
    // Oito quadros é o mínimo que a volta precisa ter: com quatro fotos, duas
    // repetições; com duas fotos, quatro.
    expect(marqueeCopies(2)).toBe(4)
    expect(marqueeCopies(3)).toBe(3)
    expect(marqueeCopies(4)).toBe(2)
    expect(marqueeCopies(8)).toBe(1)
  })

  it("lista longa não vira volta vazia (a volta tem os quadros que tem)", () => {
    expect(marqueeCopies(9)).toBe(1)
    expect(marqueeCopies(24)).toBe(1)
  })

  it("a propriedade que fecha o laço: a volta cobre a tela", () => {
    // É esta conta que impede o buraco na emenda: qualquer lista com duas ou
    // mais fotos rende uma volta de, no mínimo, `MARQUEE_MIN_TILES` quadros.
    for (let images = 2; images <= 40; images++) {
      expect(images * marqueeCopies(images)).toBeGreaterThanOrEqual(
        MARQUEE_MIN_TILES
      )
    }
  })

  it("contagem que não é número não estoura (a volta nunca é vazia)", () => {
    expect(marqueeCopies(Number.NaN)).toBe(1)
    expect(marqueeCopies(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("instagramSecondsPerImage", () => {
  it("valor dentro da faixa passa igual", () => {
    expect(instagramSecondsPerImage(8)).toBe(8)
  })

  it("valor ausente cai no padrão", () => {
    expect(instagramSecondsPerImage(undefined)).toBe(INSTAGRAM_SPEED_DEFAULT)
    expect(instagramSecondsPerImage(null)).toBe(INSTAGRAM_SPEED_DEFAULT)
    expect(instagramSecondsPerImage("")).toBe(INSTAGRAM_SPEED_DEFAULT)
  })

  it("rápido demais sobe para o piso (borrão não é foto)", () => {
    expect(instagramSecondsPerImage(0)).toBe(INSTAGRAM_SPEED_MIN)
    expect(instagramSecondsPerImage(-10)).toBe(INSTAGRAM_SPEED_MIN)
  })

  it("lento demais desce para o teto (parado parece quebrado)", () => {
    expect(instagramSecondsPerImage(600)).toBe(INSTAGRAM_SPEED_MAX)
  })

  it("número não finito é ausência, não pedido de faixa lenta", () => {
    expect(instagramSecondsPerImage(Number.NaN)).toBe(INSTAGRAM_SPEED_DEFAULT)
    expect(instagramSecondsPerImage(Number.POSITIVE_INFINITY)).toBe(
      INSTAGRAM_SPEED_DEFAULT
    )
  })

  it("string numérica vale como número (o `data` do bloco é JSON)", () => {
    expect(instagramSecondsPerImage("8")).toBe(8)
  })

  it("texto que não é número cai no padrão", () => {
    expect(instagramSecondsPerImage("bem devagar")).toBe(
      INSTAGRAM_SPEED_DEFAULT
    )
  })
})

describe("marqueeSeconds", () => {
  it("a duração é a da volta inteira, e não a da imagem", () => {
    // Quatro fotos, duas repetições cada (oito quadros), seis segundos por
    // quadro.
    expect(marqueeSeconds(4, 6)).toBe(48)
  })

  it("cada quadro leva o tempo escolhido, com quatro fotos ou com duas", () => {
    // É a razão de o campo ser "por imagem": o ritmo não muda quando o lojista
    // sobe ou tira foto — muda a duração do laço, não o passo.
    for (const images of [2, 3, 4, 6, 8, 12]) {
      const voltas = images * marqueeCopies(images)

      expect(marqueeSeconds(images, 6) / voltas).toBe(6)
    }
  })

  it("com uma imagem a volta é a própria imagem (a seção não usa esta conta)", () => {
    expect(marqueeSeconds(1, 6)).toBe(6)
  })

  it("valor ausente anima no padrão do contrato", () => {
    expect(marqueeSeconds(4, undefined)).toBe(INSTAGRAM_SPEED_DEFAULT * 8)
  })

  it("valor fora da faixa é preso antes da conta", () => {
    expect(marqueeSeconds(4, 0)).toBe(INSTAGRAM_SPEED_MIN * 8)
    expect(marqueeSeconds(4, 600)).toBe(INSTAGRAM_SPEED_MAX * 8)
  })
})

describe("marqueeSeekOffset", () => {
  it("uma volta de arrasto vale a duração da volta", () => {
    // A propriedade que faz a foto ficar **debaixo do cursor**: o trilho anda
    // `period` px em `duration` segundos, então arrastar `period` px vale
    // `duration` segundos de relógio — e a faixa anda os mesmos `period` px.
    expect(marqueeSeekOffset(1600, 1600, 48)).toBe(48)
    expect(marqueeSeekOffset(400, 1600, 48)).toBe(12)
  })

  it("o sinal é o da mão: arrastar para a esquerda adianta a faixa", () => {
    expect(marqueeSeekOffset(-400, 1600, 48)).toBe(-12)
    expect(marqueeSeekOffset(0, 1600, 48)).toBe(0)
  })

  it("arrastar mais de uma volta continua valendo (quem volta ao começo é o CSS)", () => {
    // O valor não é preso à duração: 2,5 voltas de arrasto valem 2,5 durações, e o
    // navegador lê o resto da divisão sozinho — nenhum estado de posição para
    // sincronizar com o keyframe.
    expect(marqueeSeekOffset(4000, 1600, 48)).toBe(120)
    expect(marqueeSeekOffset(-4000, 1600, 48)).toBe(-120)
  })

  it("arrastar um quadro vale o `secondsPerImage` do lojista", () => {
    // A ponte entre o campo e o gesto: a volta tem oito quadros (quatro fotos ×
    // duas repetições) em 48s, então um quadro de dedo vale 6s de relógio — o
    // mesmo número que o lojista escolheu no CRM.
    const voltas = 4 * marqueeCopies(4)
    const duration = marqueeSeconds(4, 6)

    expect(voltas).toBe(8)
    expect(duration).toBe(48)
    expect(marqueeSeekOffset(340, voltas * 340, duration)).toBe(6)
  })

  it("medida que não existe não anda nada (e não vira `NaN` na animação)", () => {
    // O `NaN` é o defeito mudo deste arquivo: `animation-delay: -NaNs` é ignorado
    // pelo navegador, e a faixa pararia de responder ao arrasto sem erro nenhum. As
    // duas fontes dele são uma medida de layout zero (a faixa medida antes de o CSS
    // chegar) e um ponteiro sem coordenada.
    expect(marqueeSeekOffset(100, 0, 48)).toBe(0)
    expect(marqueeSeekOffset(100, -10, 48)).toBe(0)
    expect(marqueeSeekOffset(100, 1600, 0)).toBe(0)
    expect(marqueeSeekOffset(100, 1600, -48)).toBe(0)
    expect(marqueeSeekOffset(Number.NaN, 1600, 48)).toBe(0)
    expect(marqueeSeekOffset(100, Number.NaN, 48)).toBe(0)
    expect(marqueeSeekOffset(100, 1600, Number.NaN)).toBe(0)
    expect(marqueeSeekOffset(100, Number.POSITIVE_INFINITY, 48)).toBe(0)
  })
})

describe("o espelho do contrato", () => {
  // A faixa que a função aplica é a do campo que o CRM desenha e a API valida;
  // o padrão é o `secondsPerImage` da seção no conteúdo padrão. Divergência aqui
  // é o erro que só aparece em produção — o lojista escolhe 12s na tela e a loja
  // anima em 6s.
  const speedField = SECTION_FIELDS.instagram.find(
    (field) => field.name === "secondsPerImage"
  )
  const seed = DEFAULT_HOME_SECTIONS.find(
    (section) => section.type === "instagram"
  )
  const seedFields = seed as unknown as Record<string, unknown> | undefined

  it("a faixa da função é a do campo declarado no contrato", () => {
    expect(speedField).toBeDefined()
    expect([INSTAGRAM_SPEED_MIN, INSTAGRAM_SPEED_MAX]).toEqual([
      speedField?.min,
      speedField?.max,
    ])
  })

  it("a velocidade padrão é a do conteúdo padrão", () => {
    expect(typeof seedFields?.secondsPerImage).toBe("number")
    expect(INSTAGRAM_SPEED_DEFAULT).toBe(seedFields?.secondsPerImage)
  })

  it("o mínimo de quadros por volta é o que a medida de layout diz", () => {
    // O número não é campo de CMS: é a medida que impede o buraco na emenda, e
    // quem a prende é este teste — um dia alguém o copia trocado para o
    // `brand.css` e a faixa volta a ter emenda visível sem erro nenhum.
    expect(MARQUEE_MIN_TILES).toBe(8)
  })
})
