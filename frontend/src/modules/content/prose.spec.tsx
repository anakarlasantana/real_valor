/**
 * O texto longo (`prose`) no render da página.
 * -------------------------------------------------------------------------
 * O que este teste prende é a **estrutura** e a promessa do texto:
 *
 *   - o `kind` do bloco decide o elemento — o `<h2>` da seção, o `<h3>` do
 *     subtítulo, o `<p>` do parágrafo e o `<ul>` da lista — e o texto passa por
 *     `renderInline`: é o negrito do editor chegando à página, sem HTML no meio;
 *   - um bloco sem texto **sai** da página: a seção nova nasce no CRM com um
 *     parágrafo em branco, e um `<p></p>` no meio do texto é uma linha em branco
 *     que ninguém escreveu;
 *   - a seção sem nada para desenhar devolve `null` — o `ContentSectionList` não
 *     desenha a âncora vazia, e é o que impede uma página existir com 200 e nada
 *     dentro.
 *
 * A segurança (o que sai literal, o que vira link) é do parser e está presa em
 * `markdown.spec.tsx`: aqui se confere que a **página** o usa.
 */
import type { ProseBlock, ProseSection } from "@lib/content/home-sections"
import Prose from "@modules/content/prose"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

const html = (section: ProseSection) =>
  renderToStaticMarkup(<Prose section={section} />)

/** A seção como o CRM a grava — título, blocos e anexo, e nada mais. */
function prosa(over: Partial<ProseSection> = {}): ProseSection {
  return {
    id: "texto",
    type: "prose",
    enabled: true,
    position: 10,
    title: "",
    blocks: [],
    documentUrl: "",
    documentLabel: "",
    ...over,
  }
}

/** Um bloco, com a forma completa que o contrato declara. */
function bloco(over: Partial<ProseBlock> = {}): ProseBlock {
  return { kind: "paragraph", text: "", items: [], ...over }
}

describe("Prose", () => {
  it("o título da seção é um `<h2>` e o subtítulo um `<h3>`", () => {
    const markup = html(
      prosa({
        title: "Política de privacidade",
        blocks: [bloco({ kind: "subtitle", text: "Seus dados" })],
      })
    )

    expect(markup).toContain(
      '<h2 class="rv-display rv-section-heading rv-prose-title">Política de privacidade</h2>'
    )
    // O `<h3>` (e não o `<h2>` do exemplo de 14.6.3): o título da seção já é um
    // `<h2>`, e o subtítulo é um nível abaixo dele — quem lê a página por
    // cabeçalhos não pode encontrar dois títulos irmãos onde um é subordinado.
    expect(markup).toContain(
      '<h3 class="rv-display rv-section-heading rv-prose-subtitle">Seus dados</h3>'
    )
  })

  it("o parágrafo vira `<p>`, com o negrito desenhado", () => {
    const markup = html(
      prosa({
        blocks: [
          bloco({ text: "A **Real Valor** usa _dados_ mínimos." }),
        ],
      })
    )

    expect(markup).toContain('<p class="rv-section-text rv-prose-paragraph">')
    expect(markup).toContain("<strong>Real Valor</strong>")
    expect(markup).toContain("<em>dados</em>")
    // Nenhum HTML do texto é interpretado: o que chega é texto, e o React o
    // escapa. É a razão de o campo não precisar de sanitizador.
    expect(html(prosa({ blocks: [bloco({ text: "<b>x</b>" })] }))).toContain(
      "&lt;b&gt;x&lt;/b&gt;"
    )
  })

  it("a lista vira `<ul>`, uma linha por `<li>`, sem as linhas vazias", () => {
    const markup = html(
      prosa({
        blocks: [
          bloco({
            kind: "bullets",
            items: ["O prazo é de 30 dias.", "  ", "Peças sem uso."],
          }),
        ],
      })
    )

    expect(markup).toContain('<ul class="rv-section-text rv-prose-list">')
    expect(markup).toContain("<li>O prazo é de 30 dias.</li>")
    expect(markup).toContain("<li>Peças sem uso.</li>")
    // A caixa vazia do CRM é um item que ninguém escreveu — não um `<li>` solto.
    expect(markup.match(/<li>/g)?.length).toBe(2)
  })

  it("o item de uma lista aceita as mesmas marcas do parágrafo", () => {
    const markup = html(
      prosa({
        blocks: [
          bloco({
            kind: "bullets",
            items: ["Veja a [política](/privacidade)."],
          }),
        ],
      })
    )

    expect(markup).toContain('<a href="/privacidade">política</a>')
  })

  it("bloco sem texto sai da página (a seção nova nasce com um)", () => {
    const markup = html(
      prosa({
        title: "Termos de uso",
        blocks: [
          bloco(), // o parágrafo em branco que a seção nova traz do CRM
          bloco({ kind: "bullets", items: ["", "  "] }),
          bloco({ kind: "subtitle", text: "   " }),
        ],
      })
    )

    expect(markup).toContain("Termos de uso")
    expect(markup).not.toContain("<p")
    expect(markup).not.toContain("<ul")
    expect(markup).not.toContain("<h3")
  })

  it("seção sem título e sem bloco com texto não desenha nada", () => {
    expect(html(prosa())).toBe("")
    expect(html(prosa({ blocks: [bloco()] }))).toBe("")
  })

  it("o `kind` que o contrato não conhece continua legível como parágrafo", () => {
    // Uma versão futura do CRM pode gravar um tipo novo: o texto dele continua
    // na página, em vez de sumir (a mesma escolha do `supportedSections` um
    // nível acima — degradar é melhor do que apagar).
    const futuro = {
      ...bloco({ text: "Cláusula nova." }),
      kind: "quote",
    } as unknown as ProseBlock

    expect(html(prosa({ blocks: [futuro] }))).toContain("Cláusula nova.")
  })

  it("o desenho mora na régua: a coluna e as classes do tema", () => {
    // O que o componente escreve são classes (`rv-prose-body`, `rv-section-*`);
    // medida, tamanho e cor são do `brand.css`. Um utilitário aqui seria a
    // segunda régua — e o `ruler.spec.ts` prende a mesma regra nas seções da
    // home.
    const markup = html(prosa({ title: "Termos", blocks: [bloco({ text: "x" })] }))

    expect(markup).toContain('class="rv-container"')
    expect(markup).toContain("rv-section-pad rv-prose-body")
    expect(markup).toContain("rv-section-heading")
    expect(markup).toContain("rv-section-text")
  })
})

/**
 * O anexo (o PDF da página) — 14.6.3, critério 7.
 *
 * O que se prende aqui é o que o critério pede: o valor gravado é uma **chave**
 * e a loja abre o arquivo pelo **host do site** (o rewrite `/uploads/:path*`),
 * e desligar o anexo tira o botão sem tocar no texto.
 */
describe("Prose (o anexo)", () => {
  it("a chave vira um botão de baixar, com o rótulo do CRM", () => {
    const markup = html(
      prosa({
        title: "Privacidade",
        blocks: [bloco({ text: "Leia com atenção." })],
        documentUrl: "1699999999-aviso.pdf",
        documentLabel: "Baixar o aviso assinado (PDF)",
      })
    )

    // A chave sai como caminho **do próprio site** — nunca com o endereço do
    // backend, que amarraria o conteúdo ao domínio de quem respondeu o upload.
    expect(markup).toContain('href="/uploads/1699999999-aviso.pdf"')
    expect(markup).not.toContain("localhost:9000")
    // `download` é o que faz o clique baixar em vez de abrir o PDF na aba.
    expect(markup).toContain('download=""')
    expect(markup).toContain(">Baixar o aviso assinado (PDF)</a>")
    // O texto continua onde estava: o anexo complementa, não substitui.
    expect(markup).toContain("Leia com atenção.")
  })

  it("sem rótulo, o botão diz o que ele é", () => {
    const markup = html(prosa({ documentUrl: "aviso.pdf" }))

    expect(markup).toContain(">Baixar o documento (PDF)</a>")
  })

  it("sem arquivo não há botão — e o texto fica intacto", () => {
    const markup = html(
      prosa({ title: "Termos", blocks: [bloco({ text: "Os termos." })] })
    )

    expect(markup).not.toContain("rv-prose-document")
    expect(markup).toContain("Os termos.")
  })

  it("uma seção só com o anexo ainda desenha (não é página vazia)", () => {
    // Sem título e sem bloco com texto, mas com arquivo: há o que mostrar — o
    // botão. Sem esta metade da condição, o anexo sozinho sumiria e a página
    // responderia 404 com um documento publicado nela.
    expect(html(prosa({ documentUrl: "aviso.pdf" }))).toContain(
      "rv-prose-document"
    )
  })
})
