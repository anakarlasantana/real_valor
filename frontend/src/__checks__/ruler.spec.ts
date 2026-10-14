/**
 * A régua das seções da home — e os defeitos que ela escondia: a **segunda
 * régua** (o componente escreve a classe, não o valor; o Tailwind ganha do
 * `brand.css`), a **cor herdada** que não chega e o **cascade** que perde.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const fonte = (...partes: string[]) =>
  readFileSync(join(__dirname, ...partes), "utf8")

/** O `brand.css` — a régua das quatro seções: o manifesto e os parciais dele. */
const CSS = fonte("..", "styles", "brand.css")
  .split("\n")
  .filter((linha) => linha.startsWith("@import"))
  .map((linha) => fonte("..", ...linha.slice('@import "'.length, -2).split("/")))
  .join("")

/** O código de um componente desta pasta. */
const componente = (pasta: string) =>
  fonte("..", "modules", "home", "components", pasta, "index.tsx")

/** O código sem os comentários: as conferências de "isto **não** está aqui"
 * precisam disso — um cabeçalho cita a classe que deixou de usar, e sem tirar o
 * comentário o teste reprovaria a própria explicação. */
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
    // A caixa é uma só, no `brand.css`: um `aspect-` aqui seria a segunda régua.
    expect(colecoes).not.toContain("aspect-")
    // O número do cartão é a posição na lista, e não um campo do conteúdo.
    expect(colecoes).toContain("collectionNumber(index)")
  })

  it("a faixa editorial escreve o desenho em classe, e não em utilitário", () => {
    const faixa = semComentarios(componente("editorial-callout"))

    expect(faixa).toContain('"rv-callout"')
    expect(faixa).toContain("rv-callout-title")
    expect(faixa).toContain("rv-callout-cta")
    // A altura e os dois degraus do título são do `brand.css`.
    expect(faixa).not.toContain("min-h-[")
    expect(faixa).not.toContain("text-[44px]")
    expect(faixa).not.toContain("small:text-[72px]")
    // O véu é a única coisa que sobra inline (a força é do componente, como o `SCRIM`).
    expect(faixa).toContain("--rv-callout-veil")
  })

  it("o manifesto escreve o desenho em classe, e não em utilitário", () => {
    const manifesto = semComentarios(componente("editorial-banner"))

    expect(manifesto).toContain("rv-manifesto-grid")
    expect(manifesto).toContain("rv-manifesto-media")
    expect(manifesto).toContain("rv-manifesto-title")
    expect(manifesto).toContain("rv-manifesto-cta")
    // Proporção da foto, tamanho da linha manuscrita e grade de duas colunas são da régua.
    expect(manifesto).not.toContain("aspect-")
    expect(manifesto).not.toContain("text-[34px]")
    expect(manifesto).not.toContain("grid-cols-2")
    // A ordem das colunas é do componente: é o `imagePosition` do CMS, não desenho.
    expect(manifesto).toContain("imageFirst")
  })

  it("a faixa do Instagram escreve o desenho em classe, e não em utilitário", () => {
    const secao = semComentarios(componente("instagram-grid"))
    const faixa = semComentarios(
      fonte("..", "modules", "home", "components", "instagram-grid", "strip.tsx")
    )
    const quadro = semComentarios(
      fonte("..", "modules", "home", "components", "instagram-grid", "tile.tsx")
    )

    // O quadro e a faixa são da régua; o movimento é o `.rv-marquee` do ticker.
    expect(faixa).toContain("rv-marquee-track")
    expect(faixa).toContain("rv-marquee rv-insta-strip")
    expect(quadro).toContain("rv-insta-tile")
    // A proporção do quadro, o zoom do hover e o tempo dele são do `brand.css`.
    expect(quadro).not.toContain("aspect-")
    expect(quadro).not.toContain("scale-[1.04]")
    expect(quadro).not.toContain("duration-500")
    // A grade de quatro colunas é da foto única (sem laço): `grid-cols-` era a
    // segunda régua.
    expect(secao).not.toContain("grid-cols-")
    expect(secao).toContain("images.length > 1")
    expect(secao).toContain("rv-insta-grid")
  })

  it("a volta do ticker cobre a tela: a lista repetida e o piso da régua", () => {
    const barra = semComentarios(componente("announcement-bar"))

    /*
     * O `translateX(-50%)` leva **uma volta** pela tela, e o laço só fecha sem
     * buraco se a volta for mais larga: com duas mensagens curtas ela tinha
     * ~560px e a faixa preta aparecia à direita. A conta é do util (`tickerCopies`,
     * chamado pela barra); o piso é do `brand.css`, porque é o CSS quem mede a tela.
     */
    expect(barra).toContain("tickerCopies(")
    expect(barra).toContain("tickerLapSeconds(")
    // A marca desta faixa (`rv-announce-strip`) dá ao piso um lugar fora do grupo compartilhado.
    expect(barra).toContain("rv-marquee rv-announce-strip")
    // As repetições além da primeira lista saem da leitura — e da tela, parada
    // (`rv-marquee-repeat`): o leitor de tela fica com cada mensagem uma vez.
    expect(barra).toContain("index >= messages.length")
    expect(barra).toContain("aria-hidden={repeat || undefined}")
    expect(barra).toContain("rv-marquee-repeat")

    const volta = bloco(".rv-announce-strip .rv-marquee-group")

    expect(volta).toContain("min-width: 100vw")
    // A sobra é distribuída (meio vão em cada ponta): a emenda deixa de ser um
    // lugar diferente das outras junções.
    expect(volta).toContain("justify-content: space-around")
    // O piso **não** mora no `.rv-marquee-group` sozinho (dividido com o
    // Instagram): lá o quadro tem largura fixa, e um mínimo de tela daria lugar a ele.
    expect(bloco(".rv-marquee-group")).not.toContain("100vw")
  })

  it("o piso da volta sai no movimento reduzido (a lista parada é a leitura)", () => {
    const semMovimento = CSS.slice(
      CSS.indexOf("@media (prefers-reduced-motion: reduce) {")
    )

    // Com a animação fora, o trilho já é a tela inteira e o grupo volta a ser a
    // lista: o `100vw` ali seria a segunda cópia da mesma largura.
    expect(semMovimento).toContain(".rv-announce-strip .rv-marquee-group {")
    expect(semMovimento).toContain("min-width: 0")
    // O `justify-content` volta junto, por especificidade, senão a lista parada aparece espalhada.
    const parado = semMovimento.slice(
      semMovimento.indexOf(".rv-announce-strip .rv-marquee-group {")
    )

    expect(parado.slice(0, parado.indexOf("}"))).toContain(
      "justify-content: center"
    )
    // As repetições somem com o movimento: parada, a faixa não tem vão para tapar.
    expect(semMovimento).toContain(".rv-announce-strip .rv-marquee-repeat")
    expect(semMovimento).toContain("display: none")
  })

  it("a faixa do Instagram sangra: ela é irmã do container, e não filha", () => {
    const secao = semComentarios(componente("instagram-grid"))
    const onde = secao.indexOf("<InstagramStrip")

    expect(onde).toBeGreaterThan(-1)

    // O `rv-container` fecha **antes** da faixa, e é essa vizinhança que decide a
    // sangria: filha, a faixa para no respiro; irmã, atravessa a tela.
    const fecha = secao.lastIndexOf("</div>", onde)

    expect(secao.slice(0, fecha)).toContain("rv-container")
    expect(secao.slice(fecha, onde)).not.toContain("rv-container")
    // A sangria **não** é o `100vw` com margem negativa do trilho do carrossel:
    // aquele trilho mora dentro do container, este não; copiá-la daria rolagem.
    expect(semComentarios(bloco(".rv-insta-strip"))).not.toContain("100vw")
  })

  it("o arrasto da faixa é um seek do mesmo relógio, e não um segundo movimento", () => {
    const faixa = semComentarios(
      fonte("..", "modules", "home", "components", "instagram-grid", "strip.tsx")
    )

    // O ponteiro **adianta/atrasa** a animação que já existe (`animation-delay`),
    // com `marqueeSeekOffset`: um `requestAnimationFrame` seria a segunda régua.
    expect(faixa).toContain("animationDelay")
    expect(faixa).toContain("marqueeSeekOffset(")
    expect(faixa).not.toContain("requestAnimationFrame")
    expect(faixa).not.toContain("scrollLeft")
    // O gesto tem começo, meio e fim: o ponteiro fica **preso**, a mão em cima
    // para o relógio e o eixo horizontal é nosso (`touch-action`).
    expect(faixa).toContain("setPointerCapture")
    expect(faixa).toContain("rv-insta-dragging")
    expect(faixa).toContain("onPointerCancel")

    const gesto = semComentarios(bloco(".rv-insta-strip"))

    expect(gesto).toContain("cursor: grab")
    // Duas declarações, e a ordem é a decisão: o `pan-y` fica **antes** do valor
    // com `pinch-zoom`, então quem não conhece o segundo mantém o `pan-y`.
    expect(gesto).toContain("touch-action: pan-y;")
    expect(gesto).toContain("touch-action: pan-y pinch-zoom;")
    // A pausa do relógio durante o arrasto impede o salto: com a animação
    // correndo, cada `animation-delay` novo seria um pulo, não um deslocamento.
    expect(CSS).toContain(".rv-insta-strip.rv-insta-dragging .rv-marquee-track")
    // Com `prefers-reduced-motion` o cursor não promete o gesto: a classe do
    // arrasto entra na lista porque sozinha tem especificidade maior.
    const semMovimento = CSS.slice(
      CSS.indexOf("@media (prefers-reduced-motion: reduce) {")
    )

    expect(semMovimento).toContain(".rv-insta-strip.rv-insta-dragging {")
    expect(semMovimento).toContain("cursor: default")
  })

  it("o degrau de desktop do ritmo vence a base do tema", () => {
    const onde = CSS.indexOf("--rv-section-space: 6rem")

    expect(onde).toBeGreaterThan(-1)
    // O seletor que abre o bloco está logo acima: sem o `[data-theme="default"]`
    // a media query perde para a base em qualquer largura — o degrau não acontece.
    const acima = CSS.slice(Math.max(0, onde - 260), onde)

    expect(acima).toContain(':root[data-theme="default"]')
  })

  it("a seta do carrossel se ancora na borda da tela, e não na do contêiner", () => {
    // A conta é a mesma que sangra o trilho (`calc(50% - 50vw)`): o `50%` é o
    // centro do carrossel, que mora num contêiner **centrado**; de lá o `-50vw`
    // chega à borda. Ancorada no contêiner, a seta ficava a 64px da borda a 1440.
    expect(bloco(".rv-carousel-arrow-prev")).toContain(
      "left: calc(50% - 50vw + var(--rv-arrow-inset, 0.5rem))"
    )
    expect(bloco(".rv-carousel-arrow-next")).toContain(
      "right: calc(50% - 50vw + var(--rv-arrow-inset, 0.5rem))"
    )
    // E o vão é **fluido** (`clamp`): 8px no celular (a seta é o único controle
    // lá) e 20px numa tela de 2560.
    expect(CSS).toContain("--rv-arrow-inset: clamp(0.5rem, 1vw, 1.25rem)")
    // Nenhuma media query reescreve a âncora: um degrau fixo ao lado do valor
    // fluido seria a segunda régua do mesmo vão — e a que fica velha primeiro.
    const setas = CSS.slice(CSS.indexOf(".rv-carousel-arrow-next"))

    expect(setas.slice(0, setas.indexOf(".rv-carousel-dots"))).not.toContain(
      "min-width: 1024px"
    )
  })
})

/** O bloco de uma classe do `brand.css`, pelo seletor que o abre: as regras aqui
 * não aninham chaves, então o primeiro `}` depois do seletor é o fim do bloco. */
function bloco(seletor: string): string {
  const inicio = CSS.indexOf(`${seletor} {`)

  expect(inicio).toBeGreaterThan(-1)

  return CSS.slice(inicio, CSS.indexOf("}", inicio))
}
