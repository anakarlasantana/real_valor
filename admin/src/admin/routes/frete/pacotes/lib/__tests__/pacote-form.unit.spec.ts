/** O backend valida de novo: a tela só antecipa o recado. */

import {
  LIMITES,
  RASCUNHO_VAZIO,
  corpoDoPacote,
  paraRascunho,
  pesoExibido,
  podeDesativar,
  problemasDoRascunho,
  type PacoteDaTela,
} from "../pacote-form"

const pacote = (over: Partial<PacoteDaTela> = {}): PacoteDaTela => ({
  id: "p1",
  nome: "Caixa padrão",
  peso_gramas: 400,
  altura_cm: 10,
  largura_cm: 20,
  comprimento_cm: 30,
  pesoTaxavel: 1000,
  padrao: true,
  ativo: true,
  ...over,
})

const rascunho = (over = {}) => ({
  ...RASCUNHO_VAZIO,
  nome: "Caixa",
  peso_gramas: "400",
  altura_cm: "10",
  largura_cm: "20",
  comprimento_cm: "30",
  ...over,
})

describe("problemasDoRascunho", () => {
  it("deixa passar uma caixa válida", () => {
    expect(problemasDoRascunho(rascunho())).toEqual([])
  })

  it("exige nome", () => {
    expect(problemasDoRascunho(rascunho({ nome: "   " }))).toEqual([
      "Dê um nome à caixa.",
    ])
  })

  it("recusa campo vazio como se fosse zero", () => {
    expect(problemasDoRascunho(rascunho({ largura_cm: "" })).length).toBe(1)
  })

  it("usa os mesmos limites dos Correios do backend", () => {
    expect(LIMITES.largura).toEqual({ min: 11, max: 105 })
    expect(problemasDoRascunho(rascunho({ largura_cm: "5" }))[0]).toContain("largura")
  })

  it("recusa a soma acima de 200 cm mesmo com cada medida no limite", () => {
    const problemas = problemasDoRascunho(
      rascunho({ altura_cm: "100", largura_cm: "105", comprimento_cm: "105" })
    )

    expect(problemas.some((problema) => problema.includes("soma"))).toBe(true)
  })

  it("recusa peso zero e acima de 30 kg, que nenhuma transportadora leva", () => {
    expect(problemasDoRascunho(rascunho({ peso_gramas: "0" }))[0]).toContain(
      "maior que zero"
    )
    expect(problemasDoRascunho(rascunho({ peso_gramas: "30001" }))[0]).toContain(
      "30 kg"
    )
  })

  it("avisa que acima de 11 kg a caixa não serve para a J&T", () => {
    expect(problemasDoRascunho(rascunho({ peso_gramas: "11001" }))[0]).toContain(
      "J&T"
    )
  })

  it("aceita 11 kg, que é o teto da J&T", () => {
    expect(problemasDoRascunho(rascunho({ peso_gramas: "11000" }))).toEqual([])
  })
})

describe("corpoDoPacote", () => {
  it("manda número, não texto — o service compara com número", () => {
    const corpo = corpoDoPacote(rascunho({ nome: "  Envelope  " }))

    expect(corpo.nome).toBe("Envelope")
    expect(corpo.peso_gramas).toBe(400)
    expect(typeof corpo.comprimento_cm).toBe("number")
  })

  it("leva as duas chaves que decidem a cotação", () => {
    const corpo = corpoDoPacote(rascunho({ padrao: true, ativo: false }))

    expect(corpo.padrao).toBe(true)
    expect(corpo.ativo).toBe(false)
  })
})

describe("paraRascunho", () => {
  it("leva a caixa para o formulário como texto", () => {
    expect(paraRascunho(pacote())).toEqual({
      nome: "Caixa padrão",
      peso_gramas: "400",
      altura_cm: "10",
      largura_cm: "20",
      comprimento_cm: "30",
      padrao: true,
      ativo: true,
    })
  })
})

describe("podeDesativar", () => {
  it("a padrão não: sem ela a cotação fica sem caixa", () => {
    expect(podeDesativar(pacote({ padrao: true }))).toBe(false)
    expect(podeDesativar(pacote({ padrao: false }))).toBe(true)
  })
})

describe("pesoExibido", () => {
  it("mostra a cubagem quando ela é maior que o peso da caixa", () => {
    expect(pesoExibido(pacote({ peso_gramas: 400, pesoTaxavel: 1000 }))).toBe(
      "1,00 kg (cubagem)"
    )
  })

  it("mostra o peso real quando ele é o que vale", () => {
    expect(pesoExibido(pacote({ peso_gramas: 5000, pesoTaxavel: 5000 }))).toBe(
      "5,00 kg"
    )
  })
})
