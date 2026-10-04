/**
 * A ligação entre a foto do painel e o `next/image`.
 * -------------------------------------------------------------------------
 * `resolveMediaUrl` já é testado (`media.spec.ts`), e a regra é a mesma há
 * semanas. O que **não** era conferido é quem a chama — e é aí que os dois bugs
 * desta correção nasceram.
 *
 * O sintoma era o mesmo em dois lugares: foto enviada pelo painel não aparece.
 * `next/image` não repassa o pedido, ele **busca**: quem busca é o processo do
 * storefront, dentro do container dele. A URL que o painel grava é a absoluta
 * do backend (`http://localhost:9000/static/<chave>`), e `localhost` ali é o
 * próprio container — daí o `ECONNREFUSED` e o **HTTP 500** medido. Foto de
 * terceiro (Unsplash) funcionava, porque host externo não tem esse problema, o
 * que disfarçava a causa: o catálogo do seed era todo Unsplash, então só as
 * fotos novas quebravam.
 *
 * Um teste da função não pega nada disso. Passa a função, reprova o site. Por
 * isso a conferência é de **fonte**: cada componente que entrega `src` ao
 * `next/image` tem de passar por `resolveMediaUrl`.
 *
 * A regra do outro bug é a mesma forma — uma decisão que morre sem ninguém
 * notar. O `restingAt` do carrossel começava em `0`, o navegador abre o trilho
 * já deslocado pelo `scroll-padding-inline`, e o primeiro `onScroll` marcava
 * `setStopped(true)` — estado que não volta atrás. Rodízio morto antes de
 * arrancar, sem erro nenhum.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const src = (...parts: string[]) =>
  readFileSync(join(__dirname, ...parts), "utf8")

/**
 * Todas as ocorrências de um padrão, como array.
 *
 * `String.matchAll` seria o caminho óbvio, e o `tsconfig` do storefront recusa:
 * o iterador dele precisa de `downlevelIteration` ou de alvo ES2015+, eneither
 * é opção aqui. `exec` em laço com a mesma flag global devolve o mesmo
 * resultado e não acrescenta nada ao tsconfig de todo o projeto por causa de
 * um arquivo de teste.
 */
function collect(texto: string, padrao: RegExp): string[] {
  const re = new RegExp(padrao.source, padrao.flags)
  const achados: string[] = []
  let um: RegExpExecArray | null

  while ((um = re.exec(texto)) !== null) {
    achados.push(um[0])

    // Uma regex que casa vazio não avança sozinha e o laço vira infinito.
    if (um[0].length === 0) {
      re.lastIndex++
    }
  }

  return achados
}

describe("componentes que entregam src ao next/image", () => {
  /**
   * Cada par: o arquivo, e o que ele **tem** de conter. A lista é a lista dos
   * componentes que mostram foto de produto — acrescentar um sem o
   * `resolveMediaUrl` reprova aqui, que é o ponto.
   */
  const consumidores = [
    {
      arquivo: "modules/products/components/image-gallery/index.tsx",
      quem: "a galeria da página do produto",
    },
    {
      arquivo: "modules/products/components/thumbnail/index.tsx",
      quem: "a miniatura do card e da PDP",
    },
  ]

  for (const { arquivo, quem } of consumidores) {
    it(`${quem} resolve a URL antes de entregar ao otimizador`, () => {
      const codigo = src("..", "..", arquivo)

      // **O `src` que chega ao `Image`, e não a presença do símbolo.** Comentar
      // sobre `resolveMediaUrl` deixa `toContain("resolveMediaUrl")` passar com
      // o defeito de volta — foi o que aconteceu na primeira versão deste
      // arquivo, que reprovava só porque o caminho estava errado. O que
      // interessa é o valor entregue ao otimizador.
      // Só os `<Image>` de verdade: `<ImageOrPlaceholder …/>` também casa com
      // `<Image` e não tem `src` — ele **recebe** a foto como prop, e quem a
      // decide é quem o chama.
      const entregues = collect(codigo, /<Image\s[\s\S]*?\/>/g)

      expect(entregues.length).toBeGreaterThan(0)

      for (const imagem of entregues) {
        const src = /src=\{([^}]+)\}/.exec(imagem)?.[1]

        expect(src).toBeDefined()
      }

      // Nenhum `src` pode ser a URL crua de quem chamou o componente.
      //
      // A segunda forma é a que **se grava sozinha**: um componente pode
      // entregar a foto a um subcomponente como prop (`image={hoverImage}`), e
      // aí quem decide o que o `next/image` recebe é o subcomponente — o
      // `<Image>` deste arquivo passa a ter `src={image}`, uma variável que
      // parece resolvida e não é.
      const props = collect(codigo, /\bimage=\{([^}]+)\}/g).map(
        (m) => /\bimage=\{([^}]+)\}/.exec(m)?.[1] ?? ""
      )

      for (const prop of props) {
        expect(prop).not.toBe("hoverImage")
        expect(prop).not.toBe("thumbnail")
      }

      // E a função precisa entrar na conta do valor entregue.
      expect(codigo).toMatch(/resolveMediaUrl\(/)
    })
  }

  it("a capa e o hover do card passam os dois pela função", () => {
    // Só a capa resolvida deixaria o hover trocando a foto que carrega por uma
    // que devolve 500 — o card pareceria "quebrado" só ao passar o mouse.
    const codigo = src(
      "..",
      "..",
      "modules/products/components/thumbnail/index.tsx"
    )

    expect(codigo).toContain("resolveMediaUrl(thumbnail || images?.[0]?.url)")
    expect(codigo).toContain("resolveMediaUrl(hoverImage)")

    // E o hover tem de receber o **resultado**. O `HoverImage` é um
    // subcomponente com o próprio `<Image src={image}>`: o que decide é a
    // **prop** que recebe, então é nela que a função precisa aparecer.
    const usos = collect(codigo, /<HoverImage[\s\S]*?\/>/g)

    expect(usos.length).toBeGreaterThan(0)

    for (const uso of usos) {
      expect(uso).toMatch(/image=\{resolvedHover\}/)
    }
  })
})

describe("o rodízio do carrossel não morre na largada", () => {
  const codigo = src(
    "..",
    "..",
    "modules/home/components/product-carousel/index.tsx"
  )

  it("o ponto de repouso começa desconhecido, não em zero", () => {
    // `useRef(0)` é o bug: o navegador abre o trilho deslocado pelo
    // `scroll-padding-inline`, a comparação com o 0 imaginado passa da
    // tolerância e o rodízio é marcado como "assumido pela visitante" antes de
    // qualquer gesto. `null` é o estado que ainda não sabe.
    expect(codigo).toContain("useRef<number | null>(null)")
    expect(codigo).not.toMatch(/const restingAt = useRef\(0\)/)
  })

  it("a primeira leitura adota a posição do navegador em vez de comparar", () => {
    expect(codigo).toContain("restingAt.current === null")
  })

  it("o estado que para o rodízio ainda só nasce de gesto", () => {
    // `stopped` é o que fecha a WCAG 2.2.2 e é o estado que **não volta
    // atrás** — por isso não pode nascer de um detalhe de layout.
    expect(codigo).toContain("setStopped(true)")

    // A ordem importa **dentro do tratamento de scroll**: a guarda que adota a
    // posição do navegador tem de vir antes do `setStopped`. Conferir a ordem
    // no arquivo inteiro não prova nada — a primeira ocorrência de
    // `setStopped(true)` está no `onClick` da seta, antes do `onScroll`.
    const bloco = codigo.slice(
      codigo.indexOf("const onScroll"),
      codigo.indexOf("const onFocus")
    )

    expect(bloco).toContain("restingAt.current === null")
    expect(bloco.indexOf("restingAt.current === null")).toBeLessThan(
      bloco.indexOf("setStopped(true)")
    )
  })
})