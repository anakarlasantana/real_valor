/**
 * O ticker da barra de anúncio.
 * -------------------------------------------------------------------------
 * O que este teste protege são as duas decisões que, erradas, aparecem em
 * **todas** as páginas do site (a barra é cromo, não seção da home):
 *
 *   - a barra desenhada com a lista vazia: uma faixa preta de 38px no topo de
 *     toda rota, sem nada dentro;
 *   - a barra que some: uma base antiga só tem `text` (a mensagem única), e ler
 *     só `messages` apagaria a mensagem que está lá desde o começo;
 *   - a velocidade fora da faixa: 0 roda a linha como um borrão, e um valor
 *     ausente animando "sem limite" é o mesmo borrão por outro caminho;
 *   - a volta mais estreita que a tela: o `translateX(-50%)` do laço leva uma
 *     volta inteira pela tela, e uma volta curta deixa o vão da emenda à vista —
 *     a mensagem seguinte aparece no meio da barra e a faixa preta fica exposta.
 *
 * A faixa e o padrão são espelho do contrato (`SECTION_FIELDS.announcement` e o
 * `speedSeconds` do conteúdo padrão), e o espelho é conferido **aqui**: o
 * último `describe` compara os três números com o dado do contrato e a regra da
 * vírgula com a copy do seed. Aqui se testa o comportamento, e o espelho mora
 * neste arquivo desde o G4 (era `scripts/check-contract-parity.mjs`).
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import { DEFAULT_HOME_SECTIONS, SECTION_FIELDS } from "@rv/contrato"

import {
  ANNOUNCEMENT_MIN_MESSAGES,
  ANNOUNCEMENT_SPEED_DEFAULT,
  ANNOUNCEMENT_SPEED_MAX,
  ANNOUNCEMENT_SPEED_MIN,
  tickerCopies,
  tickerLapSeconds,
  tickerMessages,
  tickerSeconds,
} from "./ticker"

describe("tickerMessages", () => {
  it("a lista do ticker manda, na ordem", () => {
    expect(
      tickerMessages({ messages: ["Frete seguro", "Até 6x sem juros"] })
    ).toEqual(["Frete seguro", "Até 6x sem juros"])
  })

  it("sem lista, vale a mensagem única (base antiga não perde a barra)", () => {
    expect(tickerMessages({ text: "Frete seguro para todo o Brasil" })).toEqual([
      "Frete seguro para todo o Brasil",
    ])
  })

  it("lista preenchida substitui a mensagem única (não soma as duas)", () => {
    expect(
      tickerMessages({ text: "antiga", messages: ["nova"] })
    ).toEqual(["nova"])
  })

  it("espaço sobrando e item em branco caem fora", () => {
    expect(tickerMessages({ messages: ["  Duas por linha  ", "", "   "] })).toEqual(
      ["Duas por linha"]
    )
  })

  it("espaço em branco na mensagem única é ausência, não mensagem", () => {
    expect(tickerMessages({ text: "   " })).toEqual([])
  })

  it("item que não é texto cai fora (o `data` é texto livre)", () => {
    expect(tickerMessages({ messages: ["ok", 42, null] })).toEqual(["ok"])
  })

  it("lista que não é lista é ausência (e não um erro na tela)", () => {
    expect(tickerMessages({ messages: "Frete seguro" })).toEqual([])
  })

  it("sem mensagem nenhuma a barra não é desenhada", () => {
    expect(tickerMessages({})).toEqual([])
    expect(tickerMessages({ text: "", messages: [] })).toEqual([])
  })
})

describe("tickerSeconds", () => {
  it("valor dentro da faixa passa igual", () => {
    expect(tickerSeconds(30)).toBe(30)
  })

  it("valor ausente cai no padrão", () => {
    expect(tickerSeconds(undefined)).toBe(ANNOUNCEMENT_SPEED_DEFAULT)
    expect(tickerSeconds(null)).toBe(ANNOUNCEMENT_SPEED_DEFAULT)
    expect(tickerSeconds("")).toBe(ANNOUNCEMENT_SPEED_DEFAULT)
  })

  it("rápido demais sobe para o piso (borrão não é mensagem)", () => {
    expect(tickerSeconds(0)).toBe(ANNOUNCEMENT_SPEED_MIN)
    expect(tickerSeconds(-10)).toBe(ANNOUNCEMENT_SPEED_MIN)
  })

  it("lento demais desce para o teto (parado parece quebrado)", () => {
    expect(tickerSeconds(600)).toBe(ANNOUNCEMENT_SPEED_MAX)
  })

  it("número não finito é ausência, não pedido de ticker lento", () => {
    expect(tickerSeconds(Number.NaN)).toBe(ANNOUNCEMENT_SPEED_DEFAULT)
    expect(tickerSeconds(Number.POSITIVE_INFINITY)).toBe(
      ANNOUNCEMENT_SPEED_DEFAULT
    )
  })

  it("string numérica vale como número (o `data` do bloco é JSON)", () => {
    expect(tickerSeconds("30")).toBe(30)
  })

  it("texto que não é número cai no padrão", () => {
    expect(tickerSeconds("meio minuto")).toBe(ANNOUNCEMENT_SPEED_DEFAULT)
  })
})

describe("tickerCopies", () => {
  it("a lista se repete até a volta passar da largura da tela", () => {
    // Oito mensagens é o mínimo que a volta precisa ter: com quatro mensagens,
    // duas repetições; com duas — que é o conteúdo que está no ar —, quatro.
    expect(tickerCopies(2)).toBe(4)
    expect(tickerCopies(3)).toBe(3)
    expect(tickerCopies(4)).toBe(2)
    expect(tickerCopies(8)).toBe(1)
  })

  it("lista longa não vira volta vazia (a volta tem as mensagens que tem)", () => {
    expect(tickerCopies(9)).toBe(1)
    expect(tickerCopies(24)).toBe(1)
  })

  it("a propriedade que fecha o laço: a volta cobre o piso de mensagens", () => {
    // É esta conta que tira o vão da emenda do caminho — e ela **não** o fecha
    // sozinha: o piso de `100vw` (`.rv-announce-strip .rv-marquee-group`, no
    // `brand.css`) é quem garante o caso da mensagem curta demais, em que nem
    // oito delas enchem a tela.
    for (let messages = 2; messages <= 40; messages++) {
      expect(messages * tickerCopies(messages)).toBeGreaterThanOrEqual(
        ANNOUNCEMENT_MIN_MESSAGES
      )
    }
  })

  it("com uma mensagem só não há laço: uma volta, uma cópia", () => {
    // A barra não desenha a faixa nesse caso (é o `<p>` centrado, e quem pinta a
    // largura inteira é o fundo da seção): o valor existe para a conta não ter um
    // ramo que ninguém testa.
    expect(tickerCopies(1)).toBe(1)
    expect(tickerCopies(0)).toBe(1)
  })

  it("contagem que não é número não estoura (a volta nunca é vazia)", () => {
    expect(tickerCopies(Number.NaN)).toBe(1)
    expect(tickerCopies(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("tickerLapSeconds", () => {
  it("a duração é a da volta: o ritmo do campo, vezes as cópias", () => {
    // Duas mensagens, quatro cópias, 24s por volta da lista: a volta cheia leva
    // 96s — e a mensagem continua reaparecendo a cada 24s, que é o que o rótulo
    // do contrato promete.
    expect(tickerLapSeconds(2, 24)).toBe(96)
  })

  it("com uma lista que já cobre a tela, a duração é a do campo", () => {
    expect(tickerLapSeconds(8, 30)).toBe(30)
  })

  it("o campo continua sendo lido pela faixa do contrato", () => {
    // Sem o campo, o padrão do conteúdo padrão — e a multiplicação não o
    // transforma em 0 nem em `NaN`; fora da faixa, quem manda é o limite.
    expect(tickerLapSeconds(2, undefined)).toBe(ANNOUNCEMENT_SPEED_DEFAULT * 4)
    expect(tickerLapSeconds(2, 0)).toBe(ANNOUNCEMENT_SPEED_MIN * 4)
    expect(tickerLapSeconds(2, 600)).toBe(ANNOUNCEMENT_SPEED_MAX * 4)
  })
})

describe("o espelho do contrato", () => {
  // A faixa que a função aplica é a do campo que o CRM desenha e a API valida;
  // o padrão é o `speedSeconds` da seção no conteúdo padrão. Divergência aqui é
  // o erro que só aparece em produção — o lojista escolhe 30s na tela e a loja
  // anima em 24s.
  const speedField = SECTION_FIELDS.announcement.find(
    (field) => field.name === "speedSeconds"
  )
  const seed = DEFAULT_HOME_SECTIONS.find(
    (section) => section.type === "announcement"
  )
  const seedFields = seed as unknown as Record<string, unknown> | undefined

  it("a faixa da função é a do campo declarado no contrato", () => {
    expect(speedField).toBeDefined()
    expect([ANNOUNCEMENT_SPEED_MIN, ANNOUNCEMENT_SPEED_MAX]).toEqual([
      speedField?.min,
      speedField?.max,
    ])
  })

  it("a velocidade padrão é a do conteúdo padrão", () => {
    expect(typeof seedFields?.speedSeconds).toBe("number")
    expect(ANNOUNCEMENT_SPEED_DEFAULT).toBe(seedFields?.speedSeconds)
  })

  it("nenhuma mensagem do padrão tem vírgula", () => {
    // A vírgula é o separador da **colagem** no CRM (`list:text`): o campo é uma
    // caixa por mensagem, e colar uma lista abre várias de uma vez — uma
    // mensagem do padrão com vírgula se parte em duas quando alguém a cola no
    // painel, e o lojista não pediu isso.
    const messages = seedFields?.messages

    expect(Array.isArray(messages)).toBe(true)
    expect(
      (messages as string[]).filter((message) => message.includes(","))
    ).toEqual([])
  })

  it("o mínimo de mensagens por volta é o que a medida de layout diz", () => {
    // O número não é campo de CMS: é a medida que impede o buraco na emenda, e
    // quem a prende é este teste — um dia alguém o copia trocado e a barra volta
    // a ter o vão à vista, sem erro nenhum no console.
    expect(ANNOUNCEMENT_MIN_MESSAGES).toBe(8)
  })
})
