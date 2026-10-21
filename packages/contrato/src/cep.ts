export type EnderecoDoCep = {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

export type MotivoSemEndereco =
  "cep-incompleto" | "cep-inexistente" | "provedor-fora"

export type ResultadoCep =
  | { encontrado: true; endereco: EnderecoDoCep }
  | { encontrado: false; motivo: MotivoSemEndereco }
