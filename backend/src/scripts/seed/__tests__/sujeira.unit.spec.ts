/** A seleção do resíduo do seed antigo — provada sem banco. */
import {
  localQueFica,
  locaisExcedentes,
  opcoesForaDoMinimo,
  opcoesLegadas,
  produtosDoSeedAntigo,
} from "../sujeira"

describe("produtosDoSeedAntigo", () => {
  it("casa pelo handle, não pelo título", () => {
    expect(
      produtosDoSeedAntigo([
        { id: "prod_1", handle: "vestido-midi-linho-floral" },
        { id: "prod_2", handle: "peca-do-lojista" },
        { id: "prod_3", handle: null },
      ])
    ).toEqual(["prod_1"])
  })

  it("numa base limpa não seleciona nada", () => {
    expect(produtosDoSeedAntigo([{ id: "prod_9", handle: "blazer" }])).toEqual([])
  })
})

describe("localQueFica", () => {
  const locais = [
    { id: "loc_antigo", created_at: "2026-09-01T00:00:00Z" },
    { id: "loc_novo", created_at: "2026-10-01T00:00:00Z" },
  ]

  it("prefere o que tem estoque, mesmo sendo mais novo", () => {
    expect(localQueFica(locais, { loc_novo: 10 })).toBe("loc_novo")
  })

  it("sem estoque em nenhum, fica o mais antigo", () => {
    expect(localQueFica(locais, {})).toBe("loc_antigo")
  })

  it("sem local nenhum, devolve undefined", () => {
    expect(localQueFica([], {})).toBeUndefined()
  })
})

describe("locaisExcedentes", () => {
  it("sai só o que está vazio e não é o escolhido", () => {
    const locais = [
      { id: "loc_a", created_at: "2026-09-01T00:00:00Z" },
      { id: "loc_b", created_at: "2026-09-02T00:00:00Z" },
      { id: "loc_c", created_at: "2026-09-03T00:00:00Z" },
    ]

    expect(locaisExcedentes(locais, { loc_a: 5, loc_b: 0, loc_c: 3 })).toEqual([
      "loc_b",
    ])
  })

  it("nunca seleciona o local que fica", () => {
    const locais = [{ id: "loc_unico" }]

    expect(locaisExcedentes(locais, {})).toEqual([])
  })
})

describe("opcoesLegadas", () => {
  it("só as de preço fixo do provider manual", () => {
    expect(
      opcoesLegadas([
        { id: "so_1", provider_id: "manual_manual", price_type: "flat" },
        { id: "so_2", provider_id: "superfrete_superfrete", price_type: "calculated" },
        { id: "so_3", provider_id: "manual_manual", price_type: "calculated" },
      ])
    ).toEqual(["so_1"])
  })
})

describe("opcoesForaDoMinimo", () => {
  it("sai o serviço que não está no mínimo, mesmo sendo do SuperFrete", () => {
    expect(
      opcoesForaDoMinimo(
        [
          { id: "so_pac", provider_id: "superfrete_superfrete", data: { servico: "PAC" } },
          { id: "so_jadlog", provider_id: "superfrete_superfrete", data: { servico: "JADLOG" } },
          { id: "so_manual", provider_id: "manual_manual", data: { servico: "X" } },
        ],
        ["PAC", "SEDEX", "MINI"]
      )
    ).toEqual(["so_jadlog"])
  })
})
