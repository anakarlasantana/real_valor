/**
 * O título e a descrição de uma página de conteúdo.
 * -------------------------------------------------------------------------
 * O que este teste protege é o defeito 7 do doc 14, na metade que não se vê:
 * sem `generateMetadata`, as seis páginas novas nascem com o título do layout
 * ("Real Valor — Alfaiataria Feminina") — **a mesma página no Google**, seis
 * vezes. Não há erro, não há log, e a loja parece não ter política de troca.
 *
 * A função é pura (blocos entram, strings saem), então os três comportamentos
 * que importam são verificáveis aqui:
 *
 *   - o título sai do bloco de **abertura** (`editorial`/`banner`) e junta a
 *     ênfase, que o render desenha num `<em>` logo depois do título — no
 *     `<title>` não há `<em>`, e cortar ali deixaria "A alfaiataria que";
 *   - a descrição sai do primeiro parágrafo, numa linha só (o `body` é um
 *     `textarea`) e no tamanho que a busca mostra;
 *   - o que não existe **não é inventado**: sem bloco de abertura, o título é o
 *     nome da página; sem texto, a descrição é **ausente** (e não uma frase
 *     genérica repetida em todas as páginas).
 */
import { describe, expect, it } from "vitest"

import { DEFAULT_HOME_SECTIONS, type HomeSection } from "@rv/contrato"

import { SEO_DESCRIPTION_LIMIT, pageSeo } from "./page-seo"

/**
 * Um bloco do padrão da vitrine, pelo tipo — a mesma ideia do `defaultSection`
 * de `packages/contrato/src/defaults.ts`: o dado do teste é o dado de verdade
 * (o `editorial` do protótipo), com o que o caso pede por cima. Escrever os
 * quinze campos de um bloco aqui só faria o teste envelhecer junto do contrato.
 */
function bloco<T extends HomeSection["type"]>(
  type: T
): Extract<HomeSection, { type: T }> {
  const found = DEFAULT_HOME_SECTIONS.find((section) => section.type === type)

  if (!found) {
    throw new Error(`O padrão da vitrine não tem bloco "${type}".`)
  }

  return found as Extract<HomeSection, { type: T }>
}

describe("pageSeo", () => {
  it("o título junta o título e a ênfase, como o render desenha", () => {
    const seo = pageSeo(
      [{ ...bloco("editorial"), title: "A alfaiataria que", titleEmphasis: "valoriza você" }],
      "Sobre"
    )

    expect(seo.title).toBe("A alfaiataria que valoriza você")
  })

  it("sem ênfase, o título é o título", () => {
    const seo = pageSeo(
      [{ ...bloco("banner"), title: "Trocas e devoluções", titleEmphasis: "" }],
      "Trocas e devoluções"
    )

    expect(seo.title).toBe("Trocas e devoluções")
  })

  it("o primeiro bloco de abertura na ordem da página é quem nomeia", () => {
    const seo = pageSeo(
      [
        { ...bloco("editorial"), title: "Primeiro", titleEmphasis: "" },
        { ...bloco("banner"), title: "Segundo", titleEmphasis: "" },
      ],
      "Sobre"
    )

    expect(seo.title).toBe("Primeiro")
  })

  it("bloco que não abre página não vira título", () => {
    // Um `benefits` tem título de seção ("Por que Real Valor"), e ele não é o
    // título da página: usá-lo publicaria um título que a visitante não lê como
    // nome do endereço.
    const seo = pageSeo([bloco("benefits")], "Contato")

    expect(seo.title).toBe("Contato")
  })

  it("sem bloco de abertura, o título é o nome da página (e não o da loja)", () => {
    expect(pageSeo([], "Privacidade").title).toBe("Privacidade")
    expect(pageSeo([bloco("launches")], "Termos").title).toBe("Termos")
  })

  it("título só de espaço cai no nome da página", () => {
    const seo = pageSeo(
      [{ ...bloco("editorial"), title: "   ", titleEmphasis: "  " }],
      "Sobre"
    )

    expect(seo.title).toBe("Sobre")
  })

  it("a descrição é o texto do primeiro bloco de abertura", () => {
    const seo = pageSeo(
      [{ ...bloco("editorial"), body: "Como trocar uma peça." }],
      "Trocas"
    )

    expect(seo.description).toBe("Como trocar uma peça.")
  })

  it("a descrição vai numa linha só (o `body` é um `textarea`)", () => {
    const seo = pageSeo(
      [{ ...bloco("editorial"), body: "Primeira linha.\n\n  Segunda   linha.  " }],
      "Sobre"
    )

    expect(seo.description).toBe("Primeira linha. Segunda linha.")
  })

  it("descrição longa é cortada no limite da busca, com reticências", () => {
    const seo = pageSeo(
      [{ ...bloco("editorial"), body: "palavra ".repeat(40) }],
      "Sobre"
    )

    expect(seo.description?.endsWith("…")).toBe(true)
    // O corte cabe no que a busca mostra, e não sobra espaço antes das
    // reticências (o `trimEnd` do corte existe para isso).
    expect(seo.description!.length).toBeLessThanOrEqual(SEO_DESCRIPTION_LIMIT)
    expect(seo.description?.endsWith(" …")).toBe(false)
  })

  it("sem texto nenhum, a descrição **não existe** (nada de frase genérica)", () => {
    const seo = pageSeo([bloco("banner")], "Contato")

    // `description` ausente é o que faz o layout falar; uma string vazia
    // publicaria `<meta name="description" content="">` em toda página.
    expect("description" in seo).toBe(false)
  })

  it("o `banner` não tem `body`: a descrição vem do `editorial` seguinte", () => {
    const seo = pageSeo(
      [
        { ...bloco("banner"), title: "Trocas" },
        { ...bloco("editorial"), body: "O prazo é de 30 dias." },
      ],
      "Trocas"
    )

    expect(seo.description).toBe("O prazo é de 30 dias.")
  })
})
