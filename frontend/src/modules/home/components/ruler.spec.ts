/**
 * A régua das seções da home — e os defeitos que ela escondia
 * -------------------------------------------------------------------------
 * O desenho da capa, da faixa de vantagens, do trilho de lançamentos, da grade
 * de coleções, do manifesto (`editorial`) e da faixa editorial (`banner`) mora
 * em **um lugar só**: `brand.css`. O que este arquivo protege são as três
 * formas de a tela mentir sem erro nenhum:
 *
 *   1. **a segunda régua.** O componente escreve a classe (`rv-hero-title`), e
 *      não o valor (`text-[54px]`). No dia em que os dois conviverem, o
 *      utilitário ganha do `brand.css` (ele é importado depois) e a régua passa a
 *      ter duas fontes — a que alguém lembra de atualizar e a que está no ar.
 *      Por isso as conferências são de **fonte**, e não de unidade.
 *
 *      As duas seções editoriais reabriram exatamente este defeito: os tamanhos
 *      do manifesto e da faixa `banner` moravam no `className` e o `brand.css`
 *      não tinha `.rv-manifesto` nem `.rv-callout` nenhum — a régua dessas duas
 *      faixas **era** o Tailwind. Os dois testes do fim do arquivo prendem as
 *      famílias novas no lugar, e são a razão de elas existirem.
 *
 *      A faixa do Instagram entrou nesse mesmo lote pelo outro lado: o desenho
 *      dela (`.rv-insta-*`) é novo, mas o **movimento** é o do ticker da barra de
 *      anúncio (`.rv-marquee`, em `brand.css`), emprestado de propósito — pausa
 *      no mouse e no teclado, laço por `translateX(-50%)` e o tratamento de
 *      `prefers-reduced-motion` são comportamento de faixa contínua, e uma
 *      segunda cópia deles seria a segunda régua do mesmo movimento. O teste
 *      prende as duas famílias juntas: a de lá e a de cá.
 *
 *      A mesma seção abriu **duas** decisões que o desenho não mostra e um
 *      `not.toContain` não alcança, e as duas têm teste próprio aqui: a faixa é
 *      **irmã** do `rv-container` (a sangria de borda a borda depende disso, e o
 *      defeito é uma faixa que para no respiro, sem erro nenhum) e o arrasto é um
 *      **seek** do mesmo keyframe (o componente adianta o relógio do CSS, e não
 *      anima nada por conta própria — um `requestAnimationFrame` ou um
 *      `scrollLeft` aqui seria a segunda régua do mesmo movimento).
 *
 *   2. **a cor que não chega.** O eyebrow e a linha de apoio da capa usavam a
 *      classe de cor **herdada** e a faixa não tinha cor própria: o que chegava
 *      era o grafite do `body`, texto escuro sobre foto escura, na primeira
 *      dobra. É o defeito que abriu este lote, e o teste que o prende é o
 *      `not.toContain` do componente — em comentário a explicação pode ficar; no
 *      `className`, não.
 *
 *   3. **a decisão que perde no cascade.** `--rv-section-space` tem um degrau de
 *      desktop (6rem/5rem a partir de 1024px) que **nunca aplicou**: o bloco base
 *      abre com `:root, :root[data-theme="default"]` e a media query vinha com um
 *      `:root` sozinho, de especificidade menor. Medido a 1440, o token
 *      respondia 4rem e as seções da home tinham 64px de respiro onde o próprio
 *      comentário promete 96px. O teste do fim deste arquivo prende o seletor da
 *      media query no lugar.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const fonte = (...partes: string[]) =>
  readFileSync(join(__dirname, ...partes), "utf8")

/** O `brand.css` — a régua das quatro seções. */
const CSS = fonte("..", "..", "..", "styles", "brand.css")

/** O código de um componente desta pasta. */
const componente = (pasta: string) => fonte(pasta, "index.tsx")

/**
 * O código sem os comentários.
 *
 * As conferências de "isto **não** está aqui" precisam disso: o cabeçalho de um
 * componente cita a classe que ele deixou de usar (é assim que a decisão fica
 * escrita), e sem tirar o comentário o teste reprovaria a própria explicação.
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

describe("a régua das seções da abertura", () => {
  it("a capa escreve o desenho em classe, e não em utilitário", () => {
    const capa = semComentarios(componente("hero"))

    expect(capa).toContain("rv-hero-copy")
    expect(capa).toContain("rv-hero-title")
    expect(capa).toContain("rv-hero-scrim")
    expect(capa).toContain("rv-hero-cta")
    // A altura da faixa e o tamanho do título são de lá.
    expect(capa).not.toContain("min-h-[")
    expect(capa).not.toContain("text-[38px]")
  })

  it("a cópia da capa não usa a cor herdada do body", () => {
    const capa = semComentarios(componente("hero"))

    expect(capa).not.toContain("rv-section-text-inherit")
    // E a faixa declara a cor: é dela que a cópia herda o branco.
    expect(bloco(".rv-hero")).toContain("color: #fff")
  })

  it("o véu tem dois gradientes e o celular escolhe o deitado", () => {
    const capa = semComentarios(componente("hero"))

    expect(capa).toContain("--rv-hero-scrim-x")
    expect(capa).toContain("--rv-hero-scrim-y")

    const celular = CSS.slice(CSS.indexOf("@media (max-width: 1023px) {"))

    expect(celular).toContain("background-image: var(--rv-hero-scrim-y)")
  })

  it("a vantagem é uma linha, com o ícone ao lado do texto", () => {
    const faixa = semComentarios(componente("benefits-bar"))

    expect(faixa).toContain("rv-benefit-copy")
    expect(faixa).toContain("rv-benefit-title")
    expect(faixa).toContain("rv-benefit-detail")
    // O fio da faixa é o `gap` de 1px com o fundo da lista aparecendo: um
    // `divide-x` não sobrevive à quebra de linha da contagem que vem do CRM.
    expect(faixa).not.toContain("divide-")
  })

  it("as duas vitrines usam a mesma linha de cabeçalho", () => {
    for (const pasta of ["launches-rail", "featured-products"]) {
      const arquivo = semComentarios(componente(pasta))

      expect(arquivo).toContain("rv-section-head")
      expect(arquivo).toContain("rv-section-title")
      expect(arquivo).toContain("rv-section-subtitle")
      // O tamanho do título é da régua: era este o par que o escrevia aqui.
      expect(arquivo).not.toContain("small:text-[40px]")
    }
  })

  it("o cartão de coleções não escreve proporção própria", () => {
    const colecoes = semComentarios(componente("collection-highlights"))

    expect(colecoes).toContain("rv-collection-grid")
    expect(colecoes).toContain("rv-collection-card")
    expect(colecoes).toContain("rv-collection-photo")
    // A caixa (altura, degrau, véu, zoom) é uma só, no `brand.css`: um
    // `aspect-` aqui seria a segunda régua do mesmo quadro.
    expect(colecoes).not.toContain("aspect-")
    // O número do cartão é a posição na lista, e não um campo do conteúdo.
    expect(colecoes).toContain("collectionNumber(index)")
  })

  it("a faixa editorial escreve o desenho em classe, e não em utilitário", () => {
    const faixa = semComentarios(componente("editorial-callout"))

    expect(faixa).toContain('"rv-callout"')
    expect(faixa).toContain("rv-callout-title")
    expect(faixa).toContain("rv-callout-cta")
    // A altura da faixa e os dois degraus do título são do `brand.css`: era
    // este o par que os escrevia aqui, e o utilitário ganha da régua.
    expect(faixa).not.toContain("min-h-[")
    expect(faixa).not.toContain("text-[44px]")
    expect(faixa).not.toContain("small:text-[72px]")
    // O véu é a única coisa que sobra inline (a força é do componente, como o
    // `SCRIM` da capa) — e chega em variável, para a classe só aplicá-la.
    expect(faixa).toContain("--rv-callout-veil")
  })

  it("o manifesto escreve o desenho em classe, e não em utilitário", () => {
    const manifesto = semComentarios(componente("editorial-banner"))

    expect(manifesto).toContain("rv-manifesto-grid")
    expect(manifesto).toContain("rv-manifesto-media")
    expect(manifesto).toContain("rv-manifesto-title")
    expect(manifesto).toContain("rv-manifesto-cta")
    // A proporção da foto, o tamanho da linha manuscrita e a grade de duas
    // colunas são da régua — estes três eram a segunda fonte do mesmo desenho.
    expect(manifesto).not.toContain("aspect-")
    expect(manifesto).not.toContain("text-[34px]")
    expect(manifesto).not.toContain("grid-cols-2")
    // A ordem das colunas continua sendo do componente: é o `imagePosition` do
    // CMS, e trocar a foto de lado é estrutura, não desenho.
    expect(manifesto).toContain("imageFirst")
  })

  it("a faixa do Instagram escreve o desenho em classe, e não em utilitário", () => {
    const secao = semComentarios(componente("instagram-grid"))
    const faixa = semComentarios(fonte("instagram-grid", "strip.tsx"))
    const quadro = semComentarios(fonte("instagram-grid", "tile.tsx"))

    // O quadro e a faixa são da régua, e o movimento é o `.rv-marquee` do ticker
    // — as duas famílias, uma de cada lado do arquivo de estilos.
    expect(faixa).toContain("rv-marquee-track")
    expect(faixa).toContain("rv-marquee rv-insta-strip")
    expect(quadro).toContain("rv-insta-tile")
    // A proporção do quadro, o zoom do hover e o tempo dele são do `brand.css`:
    // era este o trio que os escrevia no componente, e o utilitário ganha da
    // régua quando os dois convivem.
    expect(quadro).not.toContain("aspect-")
    expect(quadro).not.toContain("scale-[1.04]")
    expect(quadro).not.toContain("duration-500")
    // E a grade de quatro colunas não voltou: ela é da foto única (o caso em
    // que não há laço), com o mesmo quadro, e as colunas de antes eram um
    // `grid-cols-4` no `className`.
    expect(secao).not.toContain("grid-cols-")
    expect(secao).toContain("images.length > 1")
    expect(secao).toContain("rv-insta-grid")
  })

  it("a faixa do Instagram sangra: ela é irmã do container, e não filha", () => {
    const secao = semComentarios(componente("instagram-grid"))
    const onde = secao.indexOf("<InstagramStrip")

    expect(onde).toBeGreaterThan(-1)

    // O `rv-container` (a largura de leitura, 1440px com o respiro lateral) fecha
    // **antes** da faixa, e é essa vizinhança que decide a sangria: filha do
    // container, a faixa para no respiro; irmã dele, ela atravessa a tela. O
    // defeito não dá erro nenhum — dá uma faixa que para antes da borda.
    const fecha = secao.lastIndexOf("</div>", onde)

    expect(secao.slice(0, fecha)).toContain("rv-container")
    expect(secao.slice(fecha, onde)).not.toContain("rv-container")
    // E a sangria **não** é o `100vw` com margem negativa do trilho do carrossel:
    // aquela conta existe porque aquele trilho mora dentro do container, e este não
    // mora. Copiá-la aqui daria rolagem horizontal na página inteira.
    expect(semComentarios(bloco(".rv-insta-strip"))).not.toContain("100vw")
  })

  it("o arrasto da faixa é um seek do mesmo relógio, e não um segundo movimento", () => {
    const faixa = semComentarios(fonte("instagram-grid", "strip.tsx"))

    // O ponteiro **adianta ou atrasa** a animação que já existe (`animation-delay`)
    // com a conta de `lib/util/marquee.ts`: um `requestAnimationFrame` ou um
    // `scrollLeft` aqui seria a segunda régua do mesmo movimento — a que fica fora
    // de sincronia com o keyframe, e a que ninguém lembra de atualizar.
    expect(faixa).toContain("animationDelay")
    expect(faixa).toContain("marqueeSeekOffset(")
    expect(faixa).not.toContain("requestAnimationFrame")
    expect(faixa).not.toContain("scrollLeft")
    // O gesto tem começo, meio e fim declarados: o ponteiro fica **preso** à faixa
    // (o arrasto não morre na borda do bloco), a mão em cima acende o cursor e para
    // o relógio (a classe que o `brand.css` lê) e o eixo horizontal é nosso
    // (`touch-action`, no `brand.css`).
    expect(faixa).toContain("setPointerCapture")
    expect(faixa).toContain("rv-insta-dragging")
    expect(faixa).toContain("onPointerCancel")

    const gesto = semComentarios(bloco(".rv-insta-strip"))

    expect(gesto).toContain("cursor: grab")
    // Duas declarações, e a ordem delas é a decisão: o `pan-y` fica **antes** do
    // valor com `pinch-zoom`, então o navegador que não conhece o segundo descarta a
    // linha e mantém o gesto (é o `pan-y` que sustenta o arrasto), e o que conhece
    // ganha o zoom de dois dedos por cima das fotos.
    expect(gesto).toContain("touch-action: pan-y;")
    expect(gesto).toContain("touch-action: pan-y pinch-zoom;")
    // A pausa do relógio durante o arrasto é a regra que impede o salto: com a
    // animação correndo, cada `animation-delay` novo seria um pulo no meio do
    // movimento em vez de um deslocamento debaixo do dedo.
    expect(CSS).toContain(".rv-insta-strip.rv-insta-dragging .rv-marquee-track")
    // E com o movimento desligado (`prefers-reduced-motion`) o cursor não promete o
    // gesto: lá a animação sai e o arrasto não tem relógio para mover. A classe do
    // arrasto entra na mesma lista porque sozinha ela tem especificidade maior —
    // sem isso o `grabbing` voltaria justamente no modo em que nada se move.
    const semMovimento = CSS.slice(
      CSS.indexOf("@media (prefers-reduced-motion: reduce) {")
    )

    expect(semMovimento).toContain(".rv-insta-strip.rv-insta-dragging {")
    expect(semMovimento).toContain("cursor: default")
  })

  it("o degrau de desktop do ritmo vence a base do tema", () => {
    const onde = CSS.indexOf("--rv-section-space: 6rem")

    expect(onde).toBeGreaterThan(-1)
    // O seletor que abre o bloco está logo acima da declaração: sem o
    // `[data-theme="default"]` — a metade mais específica da lista da base —, a
    // media query perde para a base **em qualquer largura** e o degrau não
    // acontece.
    const acima = CSS.slice(Math.max(0, onde - 260), onde)

    expect(acima).toContain(':root[data-theme="default"]')
  })
})

/**
 * O bloco de uma classe do `brand.css`, pelo seletor que o abre.
 *
 * `indexOf` + a primeira chave de fechamento: as regras deste arquivo não
 * aninham chaves, então o primeiro `}` depois do seletor é o fim do bloco.
 */
function bloco(seletor: string): string {
  const inicio = CSS.indexOf(`${seletor} {`)

  expect(inicio).toBeGreaterThan(-1)

  return CSS.slice(inicio, CSS.indexOf("}", inicio))
}
