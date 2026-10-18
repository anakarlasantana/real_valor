import {
  DIVISOR_CUBAGEM,
  caixaValida,
  comPadraoUnico,
  padraoUnico,
  pesoCubico,
  pesoTaxavel,
  problemasDaCaixa,
  type Pacote,
} from "../pacotes"
import { calcularVolumes } from "../volumes"


function caixa(over: Partial<Pacote> = {}): Pacote {
  return {
    id: "pac_1",
    nome: "Padrão",
    peso_gramas: 400,
    altura_cm: 10,
    largura_cm: 20,
    comprimento_cm: 30,
    padrao: true,
    ativo: true,
    ...over,
  }
}

describe("peso cúbico", () => {
  it("divide o volume por 6000 e não fraciona: 20×30×10 = 1 kg", () => {
    expect(DIVISOR_CUBAGEM).toBe(6000)
    expect(
      pesoCubico({ peso_gramas: 400, altura_cm: 10, largura_cm: 20, comprimento_cm: 30 })
    ).toBe(1000)
  })

  it("arredonda para cima, nunca para baixo", () => {
    expect(
      pesoCubico({ peso_gramas: 100, altura_cm: 30, largura_cm: 30, comprimento_cm: 30 })
    ).toBe(5000)
  })
})

describe("peso taxável", () => {
  it("a cubagem vence quando a caixa é grande para o peso dela", () => {
    const volumosa = caixa({ peso_gramas: 900, altura_cm: 40, largura_cm: 30, comprimento_cm: 50 })

    expect(pesoTaxavel(volumosa)).toBe(10_000)
  })

  it("o peso real vence quando ele é maior que o cúbico", () => {
    expect(pesoTaxavel(caixa({ peso_gramas: 5000 }))).toBe(5000)
  })
})

describe("problemasDaCaixa", () => {
  it("a caixa padrão passa", () => {
    expect(problemasDaCaixa(caixa())).toEqual([])
    expect(caixaValida(caixa())).toBe(true)
  })

  it("recusa medida fora do limite dos Correios", () => {
    const problemas = problemasDaCaixa(caixa({ largura_cm: 5 }))

    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toContain("largura")
  })

  it("recusa a soma das três medidas acima de 200 cm", () => {
    const problemas = problemasDaCaixa(
      caixa({ altura_cm: 100, largura_cm: 105, comprimento_cm: 105 })
    )

    expect(caixaValida(caixa({ altura_cm: 100, largura_cm: 105, comprimento_cm: 105 }))).toBe(false)
    expect(problemas.some((problema) => problema.includes("soma"))).toBe(true)
  })

  it("recusa peso zero e peso acima de 30 kg", () => {
    expect(problemasDaCaixa(caixa({ peso_gramas: 0 }))[0]).toContain("maior que zero")
    expect(caixaValida(caixa({ peso_gramas: 30_001 }))).toBe(false)
    expect(caixaValida(caixa({ peso_gramas: 30_000 }))).toBe(true)
  })

  it("devolve todos os problemas de uma vez", () => {
    expect(
      problemasDaCaixa({
        peso_gramas: 0,
        altura_cm: 1,
        largura_cm: 1,
        comprimento_cm: 1,
      }).length
    ).toBe(4)
  })
})

describe("padrão único", () => {
  it("encontra a caixa padrão ativa", () => {
    const padrao = caixa()
    expect(padraoUnico([caixa({ id: "outra", padrao: false }), padrao])?.id).toBe("pac_1")
  })

  it("ignora a padrão desativada", () => {
    expect(padraoUnico([caixa({ ativo: false })])).toBeUndefined()
  })

  it("comPadraoUnico deixa exatamente uma marcada", () => {
    const pacotes = [
      caixa({ id: "a" }),
      caixa({ id: "b", padrao: false }),
      caixa({ id: "c", padrao: false }),
    ]

    const resultado = comPadraoUnico(pacotes, "b")

    expect(resultado.filter((pacote) => pacote.padrao).map((pacote) => pacote.id)).toEqual(["b"])
  })
})

describe("calcularVolumes", () => {
  it("sem peso de variante, cada unidade vai na caixa padrão", () => {
    const resultado = calcularVolumes(
      [{ quantidade: 3, peso_gramas: null }],
      [caixa()]
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.volumes).toHaveLength(3)
    expect(resultado.volumes[0].caixa).toBe("Padrão")
    expect(resultado.pesoGramas).toBe(3000)
  })

  it("o peso da variante escolhe a menor caixa que comporta", () => {
    const peq = caixa({ id: "p", nome: "Envelope", peso_gramas: 100, altura_cm: 2, largura_cm: 11, comprimento_cm: 16 })
    const grande = caixa({ id: "g", nome: "Grande", peso_gramas: 2000, padrao: false })

    const resultado = calcularVolumes([{ quantidade: 1, peso_gramas: 1500 }], [peq, grande])

    expect(resultado.ok && resultado.volumes[0].caixa).toBe("Grande")
  })

  it("peso acima de todas as caixas usa a padrão", () => {
    const resultado = calcularVolumes([{ quantidade: 1, peso_gramas: 9000 }], [caixa()])

    expect(resultado.ok && resultado.volumes[0].caixa).toBe("Padrão")
  })

  it("caixa inativa ou inválida não é usada", () => {
    const invalida = caixa({ id: "x", nome: "Invalida", largura_cm: 2 })
    const inativa = caixa({ id: "y", nome: "Inativa", padrao: false, ativo: false })

    const resultado = calcularVolumes([{ quantidade: 1 }], [invalida, inativa, caixa()])

    expect(resultado.ok && new Set(resultado.volumes.map((v) => v.caixa))).toEqual(new Set(["Padrão"]))
  })

  it("sem caixa elegível falha com motivo, em vez de cotar zero", () => {
    const resultado = calcularVolumes([{ quantidade: 1 }], [])

    expect(resultado).toEqual({
      ok: false,
      motivo: "Nenhuma caixa ativa serve para os Correios. Confira os pacotes.",
    })
  })

  it("carrinho sem itens falha", () => {
    expect(calcularVolumes([], [caixa()]).ok).toBe(false)
    expect(calcularVolumes([{ quantidade: 0 }], [caixa()]).ok).toBe(false)
  })
})
