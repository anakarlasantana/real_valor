/**
 * O que o CEP pode preencher; a regra é `digitado`, não `vazio` (RV-039).
 */
import type { EnderecoDoCep } from "@rv/contrato"

export type EnderecoPreenchivel = {
  address_1: string
  bairro: string
  city: string
  province: string
}

export type CampoDigitado = {
  address_1: boolean
  bairro: boolean
  city: boolean
  province: boolean
}

/** Logradouro do CEP substitui o campo; bairro/cidade/UF só se ela não digitou (RV-041). */
export function enderecoDoCep(
  prev: EnderecoPreenchivel,
  endereco: EnderecoDoCep,
  digitado: CampoDigitado
): EnderecoPreenchivel {
  const bairro = digitado.bairro ? prev.bairro : endereco.bairro
  const cidade = digitado.city ? prev.city : endereco.cidade
  const estado = digitado.province ? prev.province : endereco.estado

  return {
    address_1: endereco.logradouro || prev.address_1,
    bairro: bairro || prev.bairro,
    city: cidade || prev.city,
    province: estado || prev.province,
  }
}
