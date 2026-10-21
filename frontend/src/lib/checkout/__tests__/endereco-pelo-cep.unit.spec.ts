/**
 * O CEP não apaga o que a cliente escreveu — e preenche o que ela não escreveu.
 * O defeito: o primeiro blur mandava a busca, o aviso "Buscando endereço…"
 * re-renderizava o formulário e o endereço do carrinho (vazio) voltava por cima.
 */
import { describe, expect, it } from "vitest"

import { enderecoDoCep } from "../endereco-pelo-cep"

const paulista = {
  logradouro: "Avenida Paulista",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
}

const vazio = { address_1: "", bairro: "", city: "", province: "" }
const ninguemDigitou = {
  address_1: false,
  bairro: false,
  city: false,
  province: false,
}

describe("enderecoDoCep — o campo vazio", () => {
  it("preenche rua, bairro, cidade e UF quando a cliente não escreveu nada", () => {
    expect(enderecoDoCep(vazio, paulista, ninguemDigitou)).toEqual({
      address_1: "Avenida Paulista",
      bairro: "Bela Vista",
      city: "São Paulo",
      province: "SP",
    })
  })

  it("preenche a cidade mesmo com o logradouro já escrito à mão", () => {
    const prev = { address_1: "Rua Augusta", bairro: "", city: "", province: "" }

    expect(enderecoDoCep(prev, paulista, ninguemDigitou)).toEqual({
      address_1: "Avenida Paulista",
      bairro: "Bela Vista",
      city: "São Paulo",
      province: "SP",
    })
  })

  it("mantém cidade, UF e bairro digitados, mas aceita a rua do CEP", () => {
    const prev = {
      address_1: "Rua Augusta, 900",
      bairro: "Consolação",
      city: "Campinas",
      province: "SP",
    }

    const resultado = enderecoDoCep(prev, paulista, {
      address_1: true,
      bairro: true,
      city: true,
      province: true,
    })

    expect(resultado.city).toBe("Campinas")
    expect(resultado.province).toBe("SP")
    expect(resultado.bairro).toBe("Consolação")
    expect(resultado.address_1).toBe("Avenida Paulista")
  })
})

describe("enderecoDoCep — a segunda busca", () => {
  it("troca o logradouro e o bairro da primeira busca pelos da segunda", () => {
    const prev = {
      address_1: "Avenida Paulista",
      bairro: "Bela Vista",
      city: "São Paulo",
      province: "SP",
    }

    const rio = {
      logradouro: "Rua da Assembleia",
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      estado: "RJ",
    }

    // O valor veio do próprio CEP, não da cliente: pode ser substituído.
    expect(enderecoDoCep(prev, rio, ninguemDigitou)).toEqual({
      address_1: "Rua da Assembleia",
      bairro: "Centro",
      city: "Rio de Janeiro",
      province: "RJ",
    })
  })

  it("endereço sem logradouro (CEP de cidade inteira) não apaga o que havia", () => {
    const prev = {
      address_1: "Rodovia BR-101, km 12",
      bairro: "",
      city: "",
      province: "",
    }
    const semRua = { ...paulista, logradouro: "" }

    expect(enderecoDoCep(prev, semRua, ninguemDigitou).address_1).toBe(
      "Rodovia BR-101, km 12"
    )
  })
})

/**
 * A ordem do bloco acima é a do uso real, e é ela que o defeito quebrou: o
 * primeiro CEP chega com `buscas = 0` (ninguém digitou cidade), e o segundo
 * depois de a cliente ter mexido — ou não — em cidade e UF.
 */
describe("enderecoDoCep — o CEP de uma cidade inteira", () => {
  it("cidade, UF e bairro vazios no provedor não apagam os do campo", () => {
    const prev = {
      address_1: "",
      bairro: "Centro",
      city: "Campinas",
      province: "SP",
    }
    const soRua = {
      logradouro: "Avenida Paulista",
      bairro: "",
      cidade: "",
      estado: "",
    }

    expect(enderecoDoCep(prev, soRua, ninguemDigitou)).toEqual({
      address_1: "Avenida Paulista",
      bairro: "Centro",
      city: "Campinas",
      province: "SP",
    })
  })
})
