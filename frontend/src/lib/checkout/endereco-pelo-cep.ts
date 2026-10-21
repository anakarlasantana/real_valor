/**
 * O que o CEP pode preencher. A regra é `digitado`, não `vazio`: o que a busca
 * anterior gravou também ocupa o campo. Ver `RV-039` no doc 19.
 */
import type { EnderecoDoCep } from "@rv/contrato"

export type EnderecoPreenchivel = {
  address_1: string
  city: string
  province: string
}

/** O que a cliente digitou à mão — o número da casa, a cidade dela. */
export type CampoDigitado = {
  address_1: boolean
  city: boolean
  province: boolean
}

/** O logradouro do CEP substitui o do campo; cidade e UF só entram se ela não as escreveu. */
export function enderecoDoCep(
  prev: EnderecoPreenchivel,
  endereco: EnderecoDoCep,
  digitado: CampoDigitado
): EnderecoPreenchivel {
  const cidade = digitado.city ? prev.city : endereco.cidade
  const estado = digitado.province ? prev.province : endereco.estado

  return {
    address_1: endereco.logradouro || prev.address_1,
    city: cidade || prev.city,
    province: estado || prev.province,
  }
}
