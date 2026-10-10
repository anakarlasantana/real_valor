/**
 * O texto do conteúdo: o que vira marca, o que sai literal e o que é hostil.
 * ---------------------------------------------------------------------------
 * O caso central não é `**negrito**` — é `[clique](javascript:alert(1))`. A
 * marca de link é a **única** do subconjunto capaz de executar código sem HTML
 * nenhum, e é por isso que o `href` é allowlist. Os outros casos prendem a regra
 * que o lojista sente: marca que o site não conhece sai literal, nunca
 * desaparece.
 *
 * O último bloco é a guarda de paridade com `INLINE_MARKS` — a lista que o
 * painel vai receber pelo payload do `schema` no PR3 do doc 14. Marca declarada
 * e não desenhada falha aqui, antes de a página.
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { INLINE_MARKS, isAllowedHref, parseInline, renderInline } from "./markdown"

const html = (text: string) => renderToStaticMarkup(<>{renderInline(text)}</>)

describe("renderInline", () => {
  it("texto sem marca sai igual, e sem envoltório", () => {
    expect(html("A Real Valor usa dados")).toBe("A Real Valor usa dados")
  })

  it("as três marcas simétricas viram os elementos da tabela", () => {
    const markup = html("A **Real Valor** usa _dados_ e ~~prazos~~")

    expect(markup).toContain("<strong>Real Valor</strong>")
    expect(markup).toContain("<em>dados</em>")
    expect(markup).toContain("<s>prazos</s>")
  })

  it("marca dentro de marca é interpretada (é o que o editor rico emite)", () => {
    expect(html("**a _b_ c**")).toBe("<strong>a <em>b</em> c</strong>")
  })

  it("o caminho do próprio site e os esquemas do allowlist viram âncora", () => {
    expect(html("[Trocas](/trocas)")).toBe('<a href="/trocas">Trocas</a>')
    expect(html("[Ver](#termos)")).toBe('<a href="#termos">Ver</a>')
    expect(html("[Fale](mailto:contato@realvalor.com.br)")).toContain(
      '<a href="mailto:contato@realvalor.com.br">'
    )
    expect(html("[Ligue](tel:+5511999999999)")).toContain('<a href="tel:')
    expect(html("[Site](https://realvalor.com.br)")).toContain(
      '<a href="https://realvalor.com.br">'
    )
  })

  it("esquema hostil sai como texto, nunca como âncora", () => {
    expect(html("[clique](javascript:alert(1))")).toBe(
      "[clique](javascript:alert(1))"
    )
    expect(html("[clique](JaVaScRiPt:alert(1))")).not.toContain("<a")
    expect(html("[clique](data:text/html;base64,PHNjcmlwdD4=)")).not.toContain("<a")
    expect(html("[clique](//evil.com)")).not.toContain("<a")
    expect(html("[clique](ftp://evil.com)")).not.toContain("<a")
  })

  it("a marca que o site não conhece sai literal", () => {
    expect(html("__negrito__")).toBe("__negrito__")
    expect(html("## título")).toBe("## título")
    expect(html("- item")).toBe("- item")
    expect(html("`código`")).toBe("`código`")
  })

  it("marca aberta e não fechada sai literal", () => {
    expect(html("**a")).toBe("**a")
    expect(html("_a")).toBe("_a")
    expect(html("~~a")).toBe("~~a")
  })

  it("o delimitador não pega espaço como conteúdo", () => {
    expect(html("2 ** 3 ** 4")).toBe("2 ** 3 ** 4")
    expect(html("** a **")).toBe("** a **")
    expect(html("**a **")).not.toContain("<strong>")
  })

  it("snake_case não vira itálico (fronteira de palavra)", () => {
    expect(html("a_b_c")).toBe("a_b_c")
    expect(html("usa _dados_ aqui")).toContain("<em>dados</em>")
  })

  it("HTML no texto é escapado, não interpretado", () => {
    const markup = html("**<script>alert(1)</script>**")

    expect(markup).toContain("<strong>")
    expect(markup).toContain("&lt;script&gt;")
    expect(markup).not.toContain("<script>")
  })

  it("texto vazio não desenha nada", () => {
    expect(parseInline("")).toEqual([])
    expect(html("")).toBe("")
  })

  it("entrada patológica não estoura a pilha e sai literal", () => {
    const patologico = "_".repeat(400)

    expect(html(patologico)).toBe(patologico)
  })
})

describe("isAllowedHref", () => {
  it("aceita caminho do site, âncora, caminho relativo e os quatro esquemas", () => {
    expect(isAllowedHref("/trocas")).toBe(true)
    expect(isAllowedHref("#termos")).toBe(true)
    expect(isAllowedHref("trocas-e-devolucoes")).toBe(true)
    expect(isAllowedHref("https://realvalor.com.br")).toBe(true)
    expect(isAllowedHref("HTTP://realvalor.com.br")).toBe(true)
    expect(isAllowedHref("mailto:contato@realvalor.com.br")).toBe(true)
    expect(isAllowedHref("tel:+5511999999999")).toBe(true)
  })

  it("recusa protocolo hostil, protocolo-relativo e espaço no meio", () => {
    expect(isAllowedHref("javascript:alert(1)")).toBe(false)
    expect(isAllowedHref("JaVaScRiPt:alert(1)")).toBe(false)
    expect(isAllowedHref("data:text/html,x")).toBe(false)
    expect(isAllowedHref("vbscript:msgbox(1)")).toBe(false)
    expect(isAllowedHref("//evil.com")).toBe(false)
    expect(isAllowedHref("ftp://evil.com")).toBe(false)
    expect(isAllowedHref("java script:alert(1)")).toBe(false)
    expect(isAllowedHref("java\nscript:alert(1)")).toBe(false)
    expect(isAllowedHref("&#106;avascript:alert(1)")).toBe(false)
    expect(isAllowedHref("")).toBe(false)
  })
})

describe("paridade com INLINE_MARKS", () => {
  it("toda marca declarada é desenhada no seu elemento", () => {
    for (const { marker, element } of INLINE_MARKS) {
      expect(html(`antes ${marker}depois${marker} fim`)).toContain(
        `<${element}>depois</${element}>`
      )
    }
  })

  it("e o parser a reconhece sozinha, sem sobrar delimitador", () => {
    for (const { marker, element } of INLINE_MARKS) {
      expect(parseInline(`${marker}x${marker}`)).toEqual([
        { kind: "mark", element, children: [{ kind: "text", text: "x" }] },
      ])
    }
  })
})
