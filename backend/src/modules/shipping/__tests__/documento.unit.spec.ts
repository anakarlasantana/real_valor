/** O documento, conferido de verdade: o CPF inventado morre na etiqueta, não aqui. */
import {
  apenasDigitos,
  documentoDoDestinatario,
  documentoValido,
  formatarDocumento,
  lerDocumento,
} from "@rv/contrato"

const CPF_VALIDO = "10000000091"
const CPF_VALIDO_MASCARADO = "100.000.000-91"
const CNPJ_VALIDO = "11222333000181"

describe("lerDocumento — CPF", () => {
  it("aceita o CPF com o dígito certo, com ou sem máscara", () => {
    expect(lerDocumento(CPF_VALIDO)).toEqual({
      valido: true,
      documento: { tipo: "CPF", numero: CPF_VALIDO },
    })

    // A máscara não muda o veredito.
    expect(lerDocumento(CPF_VALIDO_MASCARADO)).toEqual({
      valido: true,
      documento: { tipo: "CPF", numero: CPF_VALIDO },
    })
  })

  it("recusa o CPF com um dígito trocado", () => {
    const errado = "10000000092"
    const lido = lerDocumento(errado)

    expect(lido.valido).toBe(false)
    expect(lido).toEqual({
      valido: false,
      mensagem: "CPF inválido. Confira os números.",
    })
  })

  it("recusa o CPF de dígitos repetidos, que passa na conta do verificador", () => {
    // O repetido satisfaz o módulo 11 — sem a trava seria o CPF mais vendido.
    for (const repetido of ["11111111111", "00000000000", "99999999999"]) {
      expect(lerDocumento(repetido).valido).toBe(false)
    }
  })

  it("compara os DOIS dígitos verificadores, não só o último", () => {
    // Só o último certo (`96`): conferir um só passaria.
    expect(lerDocumento("10000000096").valido).toBe(false)
  })

  it("diz o que fazer quando o campo está vazio, em vez de chamar de inválido", () => {
    for (const vazio of ["", "   ", null, undefined, ".--"]) {
      expect(lerDocumento(vazio)).toEqual({
        valido: false,
        mensagem: "Informe o CPF.",
      })
    }
  })

  it("recusa tamanho que não é CPF nem CNPJ, dizendo quantos números cada um tem", () => {
    for (const curto of ["1234567890", "123456789012"]) {
      expect(lerDocumento(curto)).toEqual({
        valido: false,
        mensagem:
          "O CPF tem 11 números e o CNPJ tem 14. Confira o que foi digitado.",
      })
    }
  })
})

describe("lerDocumento — CNPJ", () => {
  it("aceita o CNPJ com o dígito certo", () => {
    expect(lerDocumento("11.222.333/0001-81")).toEqual({
      valido: true,
      documento: { tipo: "CNPJ", numero: CNPJ_VALIDO },
    })
  })

  it("recusa o CNPJ com o dígito errado", () => {
    expect(lerDocumento("11222333000182").valido).toBe(false)
  })
})

describe("formatarDocumento", () => {
  it("monta a máscara do CPF", () => {
    expect(formatarDocumento(CPF_VALIDO)).toBe("100.000.000-91")
  })

  it("monta a máscara do CNPJ", () => {
    expect(formatarDocumento(CNPJ_VALIDO)).toBe("11.222.333/0001-81")
  })

  it("formata o que já foi digitado, crescendo", () => {
    expect(formatarDocumento("")).toBe("")
    expect(formatarDocumento("529")).toBe("529")
    expect(formatarDocumento("5299")).toBe("529.9")
    expect(formatarDocumento("5299822")).toBe("529.982.2")
    // Até o 11º cabe CPF; do 12º em diante, CNPJ.
    expect(formatarDocumento("11222")).toBe("112.22")
    expect(formatarDocumento("1122233300")).toBe("112.223.330-0")
    expect(formatarDocumento("112223330001")).toBe("11.222.333/0001")
  })

  it("não inventa dígitos", () => {
    expect(formatarDocumento("123456789012345678")).toBe("12.345.678/9012-34")
  })
})

/** O atalho diz o mesmo que `lerDocumento`. */
describe("documentoValido", () => {
  it("concorda com o veredito completo", () => {
    expect(documentoValido(CPF_VALIDO)).toBe(true)
    expect(documentoValido("10000000092")).toBe(false)
  })
})

describe("documentoDoDestinatario", () => {
  it("devolve o formato do SuperFrete (type + number sem máscara)", () => {
    expect(documentoDoDestinatario("100.000.000-91")).toEqual({
      type: "CPF",
      number: CPF_VALIDO,
    })
  })

  it("devolve null para documento inválido — quem emite tem de recusar", () => {
    expect(documentoDoDestinatario("")).toBe(null)
    expect(documentoDoDestinatario("12345678900")).toBe(null)
  })
})

describe("apenasDigitos", () => {
  it("tira tudo que não é número, e não quebra com nulo", () => {
    expect(apenasDigitos(CPF_VALIDO_MASCARADO)).toBe(CPF_VALIDO)
    expect(apenasDigitos(CPF_VALIDO)).toBe(CPF_VALIDO)
    expect(apenasDigitos(undefined)).toBe("")
    expect(apenasDigitos({})).toBe("")
  })
})
