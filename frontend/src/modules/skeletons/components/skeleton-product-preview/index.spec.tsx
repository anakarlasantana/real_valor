/**
 * O esqueleto do card: as mesmas caixas do card de verdade.
 * -------------------------------------------------------------------------
 * Ele é o `fallback` do `Suspense` — quer dizer, o que se vê **enquanto a peça
 * não chegou** —, e por isso não dá para fotografá-lo numa tela carregada: quando
 * a imagem é feita, ele já saiu. O que este arquivo protege é o contrato que
 * substitui o olho: o esqueleto pede as **caixas do card** (`.rv-card-media`,
 * `.rv-card-info`), e não uma cópia da régua dele. Se a proporção da foto mudar
 * no `brand.css`, o esqueleto muda junto — é o que impede a página de pular no
 * quadro em que o produto entra.
 *
 * Renderiza com `renderToStaticMarkup` porque o componente é **de servidor**,
 * como o resto do card (ver `product-rating/index.spec.tsx`, a mesma escolha pelo
 * mesmo motivo).
 */
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import SkeletonProductPreview from "."

const markup = () => renderToStaticMarkup(<SkeletonProductPreview />)

describe("SkeletonProductPreview", () => {
  it("pede as caixas do card, e não uma régua própria", () => {
    const html = markup()

    expect(html).toContain('class="rv-card-media"')
    expect(html).toContain('class="rv-card-info"')
  })

  it("a foto é 3/4 e sem moldura, como a do card", () => {
    const html = markup()

    expect(html).toContain('class="rv-thumb w-full"')
    // A proporção **não** é escrita aqui: ela vem de `.rv-card-media .rv-thumb`
    // (`brand.css`), que é a mesma regra que veste a foto do card. Se ela mudar
    // lá, o esqueleto muda junto — e é isso que impede a página de pular.
    expect(html).not.toContain("aspect-")
    // Moldura é o que o card perdeu (`brand.css`): se ela voltar por aqui, o
    // esqueleto promete uma caixa que a peça não cumpre.
    expect(html).not.toContain("p-4")
    expect(html).not.toContain("shadow")
  })

  it("as três barras são categoria, nome e preço — nesta ordem", () => {
    const html = markup()

    // A ordem é o conteúdo: a barra mais baixa é o eyebrow (8px), a mais alta é o
    // nome (18px) e a última é o preço (13px). Comparar as posições no markup é o
    // que prende a sequência — a altura sozinha passaria com as três trocadas.
    const categoria = html.indexOf("h-2 w-1/3")
    const nome = html.indexOf("h-5 w-3/5")
    const preco = html.indexOf("h-4 w-1/4")

    expect(categoria).toBeGreaterThan(-1)
    expect(nome).toBeGreaterThan(categoria)
    expect(preco).toBeGreaterThan(nome)
  })
})
