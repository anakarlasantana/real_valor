/**
 * As seções da página da peça: o que existe, em que ordem e de que tipo.
 * -------------------------------------------------------------------------
 * O defeito que este arquivo trava é o **travessão**: enquanto a ficha era um
 * bloco fixo, peça sem peso e sem dimensões mostrava "Weight  -" e
 * "Dimensions  -" para a cliente. O teste afirma o contrário — seção sem dado
 * **não existe** — porque "não existe" é uma afirmação, e "-" é outra.
 *
 * O segundo é o idioma: os rótulos e o texto de entrega estavam em inglês numa
 * loja pt-BR (RV-003).
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import type { ProductEnrichment } from "types/global"

import { fichaDaPeca, secoesDaPeca, urlDoGuia } from "./product-sections"

/** Nada cadastrado na peça, e o enriquecimento em branco. */
const SEM_ENRIQUECIMENTO: ProductEnrichment = {
  care: null,
  contraindications: null,
  sizeGuide: null,
  colors: [],
}

/** Os títulos, para as asserções falarem de seção e não de índice. */
const titulos = (lista: { titulo: string }[]) => lista.map((s) => s.titulo)

describe("fichaDaPeca", () => {
  it("só entra o campo que existe", () => {
    expect(
      fichaDaPeca({
        material: "100% viscose",
        origin_country: "Brasil",
        weight: null,
        length: null,
        width: null,
        height: null,
        type: null,
      })
    ).toEqual([
      { rotulo: "Composição", valor: "100% viscose" },
      { rotulo: "Origem", valor: "Brasil" },
    ])
  })

  it("texto em branco não vira item", () => {
    expect(fichaDaPeca({ material: "   ", origin_country: null })).toEqual([])
  })

  it("medida só entra com as três", () => {
    // Meia medida não descreve a peça: "(10 ×  × 3)" é pior do que nada.
    expect(fichaDaPeca({ length: 10, width: null, height: 3 })).toEqual([])
    expect(fichaDaPeca({ length: 10, width: 4, height: 3 })).toEqual([
      { rotulo: "Medidas", valor: "10 × 4 × 3" },
    ])
  })

  it("o peso vem em gramas, como o painel o grava", () => {
    expect(fichaDaPeca({ weight: 250 })).toEqual([
      { rotulo: "Peso", valor: "250 g" },
    ])
  })
})

describe("urlDoGuia", () => {
  it("só http(s) é link", () => {
    expect(urlDoGuia("https://exemplo.com.br/guia.pdf")).toBe(
      "https://exemplo.com.br/guia.pdf"
    )
    expect(urlDoGuia("http://exemplo.com.br/guia")).toBe(
      "http://exemplo.com.br/guia"
    )
    expect(urlDoGuia("/guias/medidas.pdf")).toBeNull()
    expect(urlDoGuia("Pergunte as medidas no WhatsApp")).toBeNull()
    expect(urlDoGuia(null)).toBeNull()
  })
})

describe("secoesDaPeca", () => {
  it("na ordem em que a cliente lê: descrição, ficha, cuidados, guia, aviso", () => {
    const secoes = secoesDaPeca(
      {
        description: "Vestido midi de viscose.",
        material: "100% viscose",
        type: { value: "Vestido" },
      },
      {
        care: "Lavar à mão.",
        contraindications: "Não indicado para pele sensível.",
        sizeGuide: "https://exemplo.com.br/guia.pdf",
        colors: [],
      }
    )

    expect(titulos(secoes)).toEqual([
      "Descrição",
      "Composição e tecido",
      "Cuidados",
      "Guia de medidas",
      "Contraindicações",
    ])
    expect(secoes[4]).toEqual({
      kind: "aviso",
      titulo: "Contraindicações",
      texto: "Não indicado para pele sensível.",
    })
    expect(secoes[3]).toEqual({
      kind: "link",
      titulo: "Guia de medidas",
      url: "https://exemplo.com.br/guia.pdf",
      rotulo: "Abrir o guia de medidas",
    })
  })

  it("peça sem nada cadastrado não gera seção nenhuma", () => {
    // Nada de travessão, nada de cabeçalho vazio.
    expect(secoesDaPeca({}, SEM_ENRIQUECIMENTO)).toEqual([])
  })

  it("guia que não é endereço vira texto, e não link quebrado", () => {
    const secoes = secoesDaPeca(
      {},
      {
        ...SEM_ENRIQUECIMENTO,
        sizeGuide: "Medidas no chat, tire suas dúvidas.",
      }
    )

    expect(secoes).toEqual([
      {
        kind: "texto",
        titulo: "Guia de medidas",
        texto: "Medidas no chat, tire suas dúvidas.",
      },
    ])
  })

  it("descrição em branco não desenha a seção", () => {
    expect(
      secoesDaPeca({ description: "   " }, SEM_ENRIQUECIMENTO)
    ).toEqual([])
  })
})
