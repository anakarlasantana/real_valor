import { cepValido, normalizarCep, type OpcaoDeEntrega } from "./shipping-quote"

export type EstadoDoCep =
  | { fase: "vazio" }
  | { fase: "invalido" }
  | { fase: "carregando"; cep: string }
  | { fase: "ok"; cep: string; opcoes: OpcaoDeEntrega[] }
  | { fase: "sem-opcao"; cep: string }
  | { fase: "erro"; mensagem: string }

export type RespostaDaCotacao =
  | { ok: true; opcoes: OpcaoDeEntrega[] }
  | { ok: false; mensagem: string }

export const CEP_INVALIDO = "Não encontramos esse CEP. Está bem escrito?"
export const CALCULANDO = "Calculando…"
export const SEM_OPCAO = "Não há entrega para esse CEP no momento."
export const FALHA_NA_COTACAO =
  "Não conseguimos calcular o frete agora. Tente de novo em instantes."

export function estadoAoConsultar(digitado: string | null | undefined): EstadoDoCep {
  const cep = normalizarCep(digitado)

  return cepValido(cep) ? { fase: "carregando", cep } : { fase: "invalido" }
}

export function estadoDaResposta(
  resposta: RespostaDaCotacao,
  cep: string
): EstadoDoCep {
  if (!resposta.ok) {
    return { fase: "erro", mensagem: resposta.mensagem }
  }

  return resposta.opcoes.length > 0
    ? { fase: "ok", cep, opcoes: resposta.opcoes }
    : { fase: "sem-opcao", cep }
}

export function mensagemDoEstado(estado: EstadoDoCep): string | null {
  switch (estado.fase) {
    case "invalido":
      return CEP_INVALIDO
    case "carregando":
      return CALCULANDO
    case "sem-opcao":
      return SEM_OPCAO
    case "erro":
      return estado.mensagem
    default:
      return null
  }
}
