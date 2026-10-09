/**
 * A regra dos filtros do catálogo, sem tela.
 *
 * O que se afirma aqui é o que a cliente compara depois de marcar uma caixa: o
 * número ao lado do valor, a ordem em que os tamanhos se leem, o que cada faixa de
 * preço inclui e como duas facetas se somam. Nada disso precisa de DOM — e é por
 * isso que a regra mora em `catalog-filters.ts`, e não dentro do painel.
 */
import { describe, expect, it } from "vitest"

import {
  arredondarSignificativo,
  construirFacetas,
  ehTituloDeTamanho,
  faixasDePreco,
  filtrarProdutos,
  menorPrecoDaPeca,
  precoNaFaixa,
  selecaoDaUrl,
  temSelecao,
  type ProdutoFiltravel,
} from "./catalog-filters"

const MOEDA = "brl"

/** Uma peça mínima: categoria, tamanho, cor e um preço. */
function peca(over: Partial<ProdutoFiltravel> = {}): ProdutoFiltravel {
  return {
    categories: [{ name: "Vestidos", handle: "vestidos" }],
    options: [
      { title: "Tamanho", values: [{ value: "M" }] },
      { title: "Cor", values: [{ value: "Preto" }] },
    ],
    variants: [
      {
        options: [{ value: "Preto" }],
        inventory_quantity: 10,
        manage_inventory: true,
        calculated_price: { calculated_amount: 300 },
      },
    ],
    ...over,
  }
}

describe("o título de tamanho", () => {
  it("não depende de caixa nem de acento", () => {
    expect(ehTituloDeTamanho("Tamanho")).toBe(true)
    expect(ehTituloDeTamanho("SIZE")).toBe(true)
    expect(ehTituloDeTamanho("tamanhos")).toBe(true)
  })

  it("não confunde cor com tamanho (a mesma regra do card)", () => {
    expect(ehTituloDeTamanho("Cor")).toBe(false)
    expect(ehTituloDeTamanho(null)).toBe(false)
  })
})

describe("a faceta de tamanho", () => {
  it("lê os tamanhos da opção de tamanho, e ordena do menor para o maior", () => {
    const produtos = [
      peca({
        options: [{ title: "Tamanho", values: [{ value: "G" }, { value: "P" }] }],
      }),
      peca({ options: [{ title: "Tamanho", values: [{ value: "M" }] }] }),
    ]

    const [, tamanho] = construirFacetas(produtos, { currencyCode: MOEDA })

    expect(tamanho.title).toBe("Tamanho")
    expect(tamanho.options.map((opcao) => opcao.label)).toEqual(["P", "M", "G"])
    expect(tamanho.options.map((opcao) => opcao.count)).toEqual([1, 1, 1])
  })

  it("tamanho fora da lista vai para o fim, e não é escondido", () => {
    const produtos = [
      peca({ options: [{ title: "Tamanho", values: [{ value: "38 (P)" }] }] }),
      peca({ options: [{ title: "Tamanho", values: [{ value: "M" }] }] }),
    ]

    const [, tamanho] = construirFacetas(produtos, { currencyCode: MOEDA })

    expect(tamanho.options.map((opcao) => opcao.label)).toEqual(["M", "38 (P)"])
  })
})

describe("a contagem", () => {
  it("conta a peça uma vez por valor, mesmo com o valor repetido nas variantes", () => {
    const produtos = [
      peca({
        variants: [
          {
            options: [{ value: "Preto" }],
            calculated_price: { calculated_amount: 100 },
          },
          {
            options: [{ value: "Preto" }],
            calculated_price: { calculated_amount: 120 },
          },
        ],
      }),
    ]

    const cor = construirFacetas(produtos, { currencyCode: MOEDA }).find(
      (faceta) => faceta.key === "color"
    )

    expect(cor?.options).toEqual([{ value: "Preto", label: "Preto", count: 1 }])
  })

  it("uma peça em duas categorias conta nas duas", () => {
    const produtos = [
      peca({
        categories: [
          { name: "Vestidos", handle: "vestidos" },
          { name: "Novidades", handle: "novidades" },
        ],
      }),
    ]

    const categoria = construirFacetas(produtos, { currencyCode: MOEDA })[0]

    expect(categoria.options.map((opcao) => opcao.count)).toEqual([1, 1])
  })
})

describe("a faixa de preço", () => {
  const produtos = [
    peca({ variants: [{ calculated_price: { calculated_amount: 100 } }] }),
    peca({ variants: [{ calculated_price: { calculated_amount: 500 } }] }),
    peca({ variants: [{ calculated_price: { calculated_amount: 900 } }] }),
  ]

  it("sai dos preços que existem, e toda peça cai em uma faixa", () => {
    const faixas = faixasDePreco(produtos, MOEDA)

    expect(faixas).toHaveLength(3)
    expect(faixas.reduce((total, faixa) => total + faixa.count, 0)).toBe(3)
    expect(faixas[0].label).toContain("R$")
  })

  it("as fronteiras são arredondadas para preço legível", () => {
    expect(arredondarSignificativo(366.66)).toBe(370)
    expect(arredondarSignificativo(633.33)).toBe(630)
    expect(arredondarSignificativo(0)).toBe(0)
  })

  it("o teto é exclusivo e a última faixa é aberta", () => {
    const faixas = faixasDePreco(produtos, MOEDA)
    const [primeira, segunda] = faixas

    const corte = Number(primeira.value.split("-")[1])

    expect(precoNaFaixa(corte - 1, primeira.value)).toBe(true)
    expect(precoNaFaixa(corte, primeira.value)).toBe(false)
    expect(precoNaFaixa(corte, segunda.value)).toBe(true)
    expect(precoNaFaixa(1_000_000, faixas[2].value)).toBe(true)
  })

  it("preço que a região não tem não entra em faixa nenhuma", () => {
    expect(precoNaFaixa(null, "100-")).toBe(false)
    expect(menorPrecoDaPeca(peca({ variants: [] }))).toBeNull()
  })

  it("faixa escrita à mão na URL, sem número, não casa com nada", () => {
    expect(precoNaFaixa(300, "abc-")).toBe(false)
    expect(precoNaFaixa(300, "-")).toBe(true)
  })

  it("catálogo de preço único vira uma faixa só, com o preço no rótulo", () => {
    const faixas = faixasDePreco([peca(), peca()], MOEDA)

    expect(faixas).toHaveLength(1)
    expect(faixas[0].count).toBe(2)
    expect(faixas[0].label).not.toContain("Infinity")
  })
})

describe("a seleção vem da URL", () => {
  it("aceita vírgula e chave repetida, e apara espaço", () => {
    const params = new URLSearchParams("?color=Preto, Branco&size=M&color=Azul")

    expect(selecaoDaUrl(params)).toEqual({
      color: ["Preto", "Branco", "Azul"],
      size: ["M"],
    })
  })

  it("valor vazio é ausência, não um valor em branco", () => {
    expect(selecaoDaUrl(new URLSearchParams("?color=&size="))).toEqual({})
    expect(temSelecao({})).toBe(false)
    expect(temSelecao({ color: [] })).toBe(false)
    expect(temSelecao({ color: ["Preto"] })).toBe(true)
  })

  it("lê o `searchParams` do Next, que chega como objeto", () => {
    expect(
      selecaoDaUrl({ category: ["vestidos", "novidades"], q: "seda" })
    ).toEqual({ category: ["vestidos", "novidades"] })

    expect(selecaoDaUrl({ category: "vestidos" })).toEqual({
      category: ["vestidos"],
    })
  })
})

describe("o filtro", () => {
  const vestido = peca()
  const camisa = peca({
    categories: [{ name: "Blusas & Camisas", handle: "blusas-camisas" }],
    options: [
      { title: "Tamanho", values: [{ value: "P" }] },
      { title: "Cor", values: [{ value: "Branco" }] },
    ],
    variants: [
      {
        options: [{ value: "Branco" }],
        inventory_quantity: 0,
        allow_backorder: true,
        manage_inventory: true,
        calculated_price: { calculated_amount: 200 },
      },
    ],
  })
  const catalogo = [vestido, camisa]

  it("sem marcação devolve a MESMA lista (a grade sem filtro não paga pelo filtro)", () => {
    expect(filtrarProdutos(catalogo, {})).toBe(catalogo)
  })

  it("dentro de uma faceta soma (OU)", () => {
    expect(
      filtrarProdutos(catalogo, {
        category: ["vestidos", "blusas-camisas"],
      })
    ).toHaveLength(2)
  })

  it("entre facetas soma (E)", () => {
    expect(
      filtrarProdutos(catalogo, { category: ["vestidos"], size: ["P"] })
    ).toHaveLength(0)

    expect(
      filtrarProdutos(catalogo, { category: ["vestidos"], size: ["M"] })
    ).toEqual([vestido])
  })

  it("filtra por disponibilidade e por faixa de preço", () => {
    expect(
      filtrarProdutos(catalogo, { availability: ["sob-demanda"] })
    ).toEqual([camisa])

    expect(filtrarProdutos(catalogo, { price: ["-250"] })).toEqual([camisa])
  })
})

describe("as facetas que não têm o que mostrar", () => {
  it("somem, em vez de abrir vazias", () => {
    const semNada = peca({
      categories: [],
      options: [],
      variants: [{ calculated_price: { calculated_amount: 100 } }],
    })

    const chaves = construirFacetas([semNada], { currencyCode: MOEDA }).map(
      (faceta) => faceta.key
    )

    expect(chaves).not.toContain("category")
    expect(chaves).not.toContain("size")
    expect(chaves).not.toContain("color")
    expect(chaves).toContain("price")
  })

  it("mas o valor MARCADO continua na lista, mesmo com zero peças", () => {
    const faceta = construirFacetas([peca()], {
      currencyCode: MOEDA,
      selecao: { color: ["Nude Areia"] },
    }).find((candidata) => candidata.key === "color")

    expect(faceta?.options).toContainEqual({
      value: "Nude Areia",
      label: "Nude Areia",
      count: 0,
    })
  })

  it("a opção que a combinação não alcança fica na lista, com zero", () => {
    // A peça é M e preta. Marcando "Branco" (que ela não tem), o tamanho dela
    // continua na lista de tamanhos — desabilitado, e não sumido: sumir diria
    // que a loja não fabrica M.
    const faceta = construirFacetas([peca()], {
      currencyCode: MOEDA,
      selecao: { color: ["Branco"] },
    }).find((candidata) => candidata.key === "size")

    expect(faceta?.options).toContainEqual({ value: "M", label: "M", count: 0 })
  })
})

describe("a contagem entre facetas", () => {
  const vestido = peca()
  const camisa = peca({
    categories: [{ name: "Blusas & Camisas", handle: "blusas-camisas" }],
    options: [
      { title: "Tamanho", values: [{ value: "P" }] },
      { title: "Cor", values: [{ value: "Branco" }] },
    ],
    variants: [
      {
        options: [{ value: "Branco" }],
        inventory_quantity: 10,
        manage_inventory: true,
        calculated_price: { calculated_amount: 200 },
      },
    ],
  })
  const catalogo = [vestido, camisa]

  const faceta = (chave: string, selecao: Record<string, string[]> = {}) =>
    construirFacetas(catalogo, { currencyCode: MOEDA, selecao }).find(
      (candidata) => candidata.key === chave
    )

  it("a faceta não conta a si mesma (o valor marcado não zera no mesmo clique)", () => {
    const semFiltro = faceta("color")
    const comFiltro = faceta("color", { color: ["Preto"] })

    expect(comFiltro?.options).toEqual(semFiltro?.options)
  })

  it("mas conta o que os OUTROS filtros deixaram", () => {
    // O vestido é M preto; a camisa é P branca. Sem filtro, há um P e um M.
    expect(faceta("size")?.options.map((opcao) => opcao.count)).toEqual([1, 1])

    // Marcando "Preto", quem responde à pergunta "tem P nesse preto?" é a
    // contagem do recorte: zero. O valor continua na lista.
    expect(
      faceta("size", { color: ["Preto"] })?.options.map((opcao) => opcao.count)
    ).toEqual([0, 1])
  })

  it("a categoria de quem não sobrou nenhuma peça também aparece, com zero", () => {
    expect(
      faceta("category", { color: ["Preto"] })?.options.map((opcao) => [
        opcao.label,
        opcao.count,
      ])
    ).toEqual([
      ["Blusas & Camisas", 0],
      ["Vestidos", 1],
    ])
  })
})
