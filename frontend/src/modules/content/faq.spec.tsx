/**
 * As perguntas frequentes (`faq`) no render da página.
 * -------------------------------------------------------------------------
 * O que este teste prende é a **forma nativa** e a promessa do par:
 *
 *   - cada pergunta é um `<details>` com o `<summary>` (a linha clicável) e a
 *     resposta dentro: é o elemento que o navegador já sabe abrir por teclado,
 *     sem JavaScript nenhum;
 *   - a resposta **está no HTML** com o `<details>` fechado — é o que faz a
 *     página ser indexável, e é a razão de o tipo existir (14.6.2);
 *   - a resposta passa por `renderInline` (o parser do `prose`), e a pergunta
 *     **não**: ela é `text`, e o que a loja não desenha ela também não esconde;
 *   - o par incompleto **sai**: pergunta sem resposta abriria um botão vazio, e
 *     resposta sem pergunta é uma linha que não diz o que abre;
 *   - a seção sem nada para desenhar devolve `null` — o `ContentSectionList` não
 *     desenha a âncora vazia.
 *
 * A segurança (o que sai literal, o que vira link) é do parser e está presa em
 * `markdown.spec.tsx`: aqui se confere que a **página** o usa.
 */
import type { FaqItem, FaqSection } from "@lib/content/home-sections"
import Faq from "@modules/content/faq"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

const html = (section: FaqSection) => renderToStaticMarkup(<Faq section={section} />)

/** A seção como o CRM a grava — título e itens, e nada mais. */
function perguntas(over: Partial<FaqSection> = {}): FaqSection {
  return {
    id: "faq",
    type: "faq",
    enabled: true,
    position: 10,
    title: "",
    items: [],
    ...over,
  }
}

/** Um item, com a forma completa que o contrato declara. */
function item(over: Partial<FaqItem> = {}): FaqItem {
  return { question: "", answer: "", ...over }
}

describe("Faq", () => {
  it("cada pergunta é um `<details>` com `<summary>` e a resposta dentro", () => {
    const markup = html(
      perguntas({
        title: "Perguntas frequentes",
        items: [
          item({ question: "Qual o prazo de troca?", answer: "Trinta dias." }),
          item({ question: "Vocês entregam?", answer: "Entregamos." }),
        ],
      })
    )

    expect(markup).toContain(
      '<h2 class="rv-display rv-section-heading rv-faq-title">Perguntas frequentes</h2>'
    )
    expect(markup).toContain('<details class="rv-faq-item">')
    // Duas perguntas, dois pares — e a ordem é a da lista do CRM.
    expect(markup.match(/<details class="rv-faq-item">/g)).toHaveLength(2)
    expect(markup).toContain(
      '<summary class="rv-section-heading rv-faq-question">Qual o prazo de troca?</summary>'
    )
    expect(markup.indexOf("Qual o prazo")).toBeLessThan(
      markup.indexOf("Vocês entregam?")
    )
    expect(markup).toContain(
      '<p class="rv-section-text rv-faq-answer">Trinta dias.</p>'
    )
  })

  it("a resposta está no HTML com o item fechado (é o que a indexa)", () => {
    // O critério que escolheu `<details>` em vez de um acordeão de `div`: para o
    // buscador, para o leitor de tela e para o `Ctrl+F` a resposta está na
    // página, mesmo com o item fechado — e com as marcas já desenhadas nela.
    // `open` não aparece: quem abre é a cliente, e o atributo não é do conteúdo.
    const markup = html(
      perguntas({
        items: [item({ question: "É seguro?", answer: "É **muito** seguro." })],
      })
    )

    expect(markup).toContain("É <strong>muito</strong> seguro.")
    expect(markup).not.toContain("<details open")
  })

  it("a resposta passa por `renderInline`, e o HTML dela é texto", () => {
    const markup = html(
      perguntas({
        items: [
          item({
            question: "Como funciona?",
            answer: "A **Real Valor** guarda _dados_ mínimos.",
          }),
        ],
      })
    )

    expect(markup).toContain("<strong>Real Valor</strong>")
    expect(markup).toContain("<em>dados</em>")
    // O que é texto, o React escapa — o mesmo contrato do `prose`.
    expect(
      html(perguntas({ items: [item({ question: "x", answer: "<b>x</b>" })] }))
    ).toContain("&lt;b&gt;x&lt;/b&gt;")
  })

  it("a pergunta é `text` e sai literal: marca é da resposta, não dela", () => {
    // A assimetria é declarada no contrato (`FaqItem`): a pergunta é uma linha
    // que a cliente lê para escolher o que abrir, e o campo é `text` — sem barra
    // de marcas no CRM. Um `**` digitado ali aparece, em vez de sumir.
    const markup = html(
      perguntas({
        items: [item({ question: "É **mesmo** assim?", answer: "É." })],
      })
    )

    expect(markup).toContain("É **mesmo** assim?")
    expect(markup).not.toContain("<strong>mesmo</strong>")
  })

  it("resposta em branco tira o item: botão que não abre nada é pior", () => {
    // O item nasce assim no CRM (os dois campos em branco). Publicá-lo seria
    // publicar uma linha que abre e não mostra nada — a cliente concluiria que a
    // página está quebrada.
    const markup = html(
      perguntas({
        title: "Perguntas frequentes",
        items: [
          item({ question: "Sem resposta ainda" }),
          item({ question: "Com resposta", answer: "Esta aparece." }),
        ],
      })
    )

    expect(markup).not.toContain("Sem resposta ainda")
    expect(markup.match(/<details class="rv-faq-item">/g)).toHaveLength(1)
    expect(markup).toContain("Com resposta")
  })

  it("pergunta em branco tira o item: não há o que clicar", () => {
    const markup = html(
      perguntas({
        title: "Perguntas frequentes",
        items: [item({ answer: "Resposta órfã." })],
      })
    )

    expect(markup).not.toContain("Resposta órfã.")
    expect(markup).not.toContain("<details")
  })

  it("item torto no `data` não derruba a seção", () => {
    // O banco é texto livre: um item que não é objeto (de uma versão anterior do
    // formulário, ou de um `PATCH` torto) sai como item incompleto — a lista
    // fica de pé, e o que dava para desenhar continua na página.
    const rude = [
      null,
      "solto",
      item({ question: "Boa", answer: "Vale." }),
    ] as unknown as FaqItem[]

    const markup = html(perguntas({ items: rude }))

    expect(markup.match(/<details class="rv-faq-item">/g)).toHaveLength(1)
    expect(markup).toContain("Boa")
  })

  it("seção sem título e sem par completo não desenha nada", () => {
    expect(html(perguntas())).toBe("")
    expect(html(perguntas({ items: [item()] }))).toBe("")
  })

  it("o desenho mora na régua: a coluna e as classes do tema", () => {
    // O que o componente escreve são classes (`rv-faq-body`, `rv-section-*`);
    // medida, fio e recuo são do `brand.css`. Um utilitário aqui seria a segunda
    // régua — e o `ruler.spec.ts` prende a mesma regra nas seções da home.
    const markup = html(
      perguntas({
        title: "Dúvidas",
        items: [item({ question: "q", answer: "a" })],
      })
    )

    expect(markup).toContain('class="rv-container"')
    expect(markup).toContain("rv-section-pad rv-faq-body")
    expect(markup).toContain("rv-section-heading")
    expect(markup).toContain("rv-section-text")
  })
})

