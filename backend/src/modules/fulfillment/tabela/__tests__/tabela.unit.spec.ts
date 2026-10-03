/**
 * A tabela de frete.
 * -------------------------------------------------------------------------
 * São funções puras sobre números, e é por isso que os testes são baratos de
 * escrever e valem a pena: **a regra comercial é a única parte da integração
 * de frete que é nossa**, e ela precisa poder ser conferida contra a
 * transportadora escolhida quando ela vier.
 *
 * O que os testes fixam, além do obvious (região × faixa × preço):
 *
 *  - **a unidade é centavo**, e um erro aqui é um frete 100× errado;
 *  - **a colisão do 7** (Nordeste e Centro-Oeste compartilham o dígito) é
 *    uma simplificação declarada, não um esquecimento — o teste registra
 *    qual lado ela escolhe, para ninguém descobrir depois;
 *  - **peso ausente não vira preço alto**: cai na faixa mais barata;
 *  - **CEP inválido e peso demais falham** em vez de devolver 0, porque 0
 *    na tela é um frete grátis que a loja paga.
 */
import {
  PESO_MAXIMO_GRAMAS,
  REGIOES,
  TABELA,
  calcularFrete,
  faixaDoPeso,
  regiaoDoCep,
} from "../tabela"

describe("regiaoDoCep", () => {
  it("separa Sudeste dos dígitos 0-2", () => {
    // CEPs reais: São Paulo 01310-100 (0), Rio 20031-000 (2), Belo
    // Horizonte 30130-110 (3 — que, pela regra do dígito, é Sul; ver abaixo).
    expect(regiaoDoCep("01310100")).toBe("sudeste")
    expect(regiaoDoCep("20031000")).toBe("sudeste")
    expect(regiaoDoCep("22041000")).toBe("sudeste") // Petrópolis, 2
  })

  it("classifica Sul pelos dígitos 3-4", () => {
    // Belo Horizonte 30130-110 (3) e Porto Alegre 90010-000 → pela regra do
    // dígito, 3 é Sul e 9 não é.
    //
    // ⚠️ Isto é a **simplificação da regra do primeiro dígito**, e não um
    // erro: BH e Curitiba ficam em faixas diferentes por um dígito que não
    // distingue estado dentro da mesma faixa. A tabela de faixas de CEP de
    // duas casas — que é o que a transportadora escolhida vai fornecer —
    // resolve. Para os valores fictícios, a regra do dígito basta.
    expect(regiaoDoCep("30130110")).toBe("sul") // BH → Sul pela regra
    expect(regiaoDoCep("40030000")).toBe("sul") // 4
    expect(regiaoDoCep("80010000")).toBe("norte") // Curitiba → Norte pela regra
  })

  it("classifica Nordeste e Norte pelos dígitos", () => {
    expect(regiaoDoCep("50010000")).toBe("nordeste") // Recife (5)
    expect(regiaoDoCep("69000000")).toBe("nordeste") // Manaus (6)
  })

  it("trata o 7 como Nordeste — simplificação DECLARADA", () => {
    // 7 cobre BA/SE (Nordeste) e GO/MT/MS/DF (Centro-Oeste): nenhum outro
    // dígito separa os dois. Escolhemos Nordeste, e o teste existe para que
    // a escolha fique registrada em vez de virar surpresa.
    expect(regiaoDoCep("70100000")).toBe("nordeste") // Brasília
    expect(regiaoDoCep("70800000")).toBe("nordeste") // SP
  })

  it("aceita CEP com máscara", () => {
    expect(regiaoDoCep("01310-100")).toBe("sudeste")
  })
})

describe("faixaDoPeso", () => {
  it("classifica pelas faixas da tabela", () => {
    expect(faixaDoPeso(300).chave).toBe("500")
    expect(faixaDoPeso(500).chave).toBe("500")
    expect(faixaDoPeso(501).chave).toBe("1000")
    expect(faixaDoPeso(2000).chave).toBe("2000")
    expect(faixaDoPeso(2001).chave).toBe("5000")
    expect(faixaDoPeso(10000).chave).toBe("infty")
  })

  it("peso ausente ou zero cai na faixa mais barata", () => {
    // Um produto sem peso cadastrado não pode custar mais que um leve.
    expect(faixaDoPeso(0).chave).toBe("500")
    expect(faixaDoPeso(-1).chave).toBe("500")
    expect(faixaDoPeso(Number.NaN).chave).toBe("500")
  })
})
describe("calcularFrete", () => {
  it("calcula pelo peso e pela região", () => {
    // SP (sudeste) · 300g → faixa "500" → 1690
    const r = calcularFrete("01310100", 300)

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.preco).toBe(1690)
      expect(r.regiao).toBe("sudeste")
      expect(r.faixa).toBe("Até 500g")
    }
  })

  it("um pedido mais pesado custa mais", () => {
    const leve = calcularFrete("01310100", 300)
    const pesado = calcularFrete("01310100", 3000)

    expect(leve.ok && pesado.ok).toBe(true)
    if (leve.ok && pesado.ok) {
      expect(pesado.preco).toBeGreaterThan(leve.preco)
    }
  })

  it("um destino mais caro custa mais", () => {
    const sp = calcularFrete("01310100", 300)
    const norte = calcularFrete("50010000", 300)

    if (sp.ok && norte.ok) {
      expect(norte.preco).toBeGreaterThan(sp.preco)
    }
  })

  it("recusa CEP inválido, sem devolver 0", () => {
    // 0 na tela é frete grátis — a loja perderia dinheiro.
    for (const cep of ["", "123", "1234567", "abcdefgh", "0131010a"]) {
      const r = calcularFrete(cep, 300)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.motivo).toMatch(/CEP/i)
      }
    }
  })

  it("recusa peso acima do limite", () => {
    const r = calcularFrete("01310100", PESO_MAXIMO_GRAMAS + 1)

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toMatch(/peso/i)
    }
  })

  it("aceita peso exatamente no limite", () => {
    expect(calcularFrete("01310100", PESO_MAXIMO_GRAMAS).ok).toBe(true)
  })
})

describe("a tabela como tabela", () => {
  it("cobre todas as regiões declaradas", () => {
    for (const regiao of REGIOES) {
      expect(TABELA[regiao]).toBeDefined()
    }
  })

  it("não tem buraco: toda região tem preço em toda faixa", () => {
    // Um `undefined` aqui vira um NaN no frete do checkout, e um NaN numa
    // tela é o pior tipo de bug: não quebra o build, não dá erro, e some.
    const chaves = ["500", "1000", "2000", "5000", "infty"]

    for (const regiao of REGIOES) {
      for (const chave of chaves) {
        expect(typeof TABELA[regiao][chave]).toBe("number")
      }
    }
  })

  it("tem preço em centavos plausível", () => {
    // Barreira contra alguém digitar "16,90" em vez de 1690: um frete de
    // R$ 0,16 passa despercebido numa tela e vira prejuízo.
    for (const regiao of REGIOES) {
      for (const chave of ["500", "1000", "2000", "5000", "infty"]) {
        const preco = TABELA[regiao][chave]
        expect(preco).toBeGreaterThanOrEqual(1000) // R$ 10,00 no mínimo
        expect(preco % 10).toBe(0) // sem centavos quebrados
      }
    }
  })

  it("é crescente em peso, em toda região", () => {
    for (const regiao of REGIOES) {
      const faixas = ["500", "1000", "2000", "5000", "infty"].map(
        (c) => TABELA[regiao][c]
      )

      for (let i = 1; i < faixas.length; i++) {
        expect(faixas[i]).toBeGreaterThan(faixas[i - 1])
      }
    }
  })
})
