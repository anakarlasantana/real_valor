/**
 * O erro de qualquer plataforma terceira, num formato só.
 *
 * Puro (o `fetch` fica no chamador). O `detalhe` sai redigido por `semPii`.
 */

import { semPii } from "./redigir"

/** O que distingue uma falha de credencial de um defeito nos dados enviados. */
export type CodigoDaFalha =
  | "CREDENCIAL"
  | "DADOS"
  | "NAO_ENCONTRADO"
  | "LIMITE"
  | "TEMPO"
  | "SEM_RESPOSTA"
  | "PLATAFORMA"

const CODIGO_POR_STATUS: Record<number, CodigoDaFalha> = {
  400: "DADOS",
  401: "CREDENCIAL",
  403: "CREDENCIAL",
  404: "NAO_ENCONTRADO",
  422: "DADOS",
  429: "LIMITE",
}

/** Status de "não houve resposta" e de timeout, usados pelo chamador. */
export const STATUS_SEM_RESPOSTA = 503
export const STATUS_TEMPO = 504

export function codigoDoStatus(status: number): CodigoDaFalha {
  // Não são HTTP: nascem do `fetch` que lançou, e colidem com 503/504 reais.
  if (status === STATUS_SEM_RESPOSTA) {
    return "SEM_RESPOSTA"
  }

  if (status === STATUS_TEMPO) {
    return "TEMPO"
  }

  if (status >= 500) {
    return "PLATAFORMA"
  }

  return CODIGO_POR_STATUS[status] ?? "PLATAFORMA"
}

export type FalhaDaPlataforma = {
  plataforma: string
  /** `POST /api/v0/calculator` — o que foi chamado, para o log bastar. */
  operacao: string
  status: number
  mensagem: string
  codigo: CodigoDaFalha
  /** O que a plataforma disse, já redigido. */
  detalhe?: unknown
}

export class ErroDePlataforma extends Error {
  readonly plataforma: string
  readonly operacao: string
  readonly status: number
  readonly codigo: CodigoDaFalha
  readonly detalhe?: unknown

  constructor({
    plataforma,
    operacao,
    status,
    mensagem,
    codigo,
    detalhe,
  }: FalhaDaPlataforma) {
    super(mensagem)
    this.name = "ErroDePlataforma"
    this.plataforma = plataforma
    this.operacao = operacao
    this.status = status
    this.codigo = codigo
    this.detalhe = detalhe
  }
}

const MAX_DETALHE = 300

/** Um valor que sirva de resposta ao operador, ou `undefined`. */
function textoDe(valor: unknown): string | undefined {
  if (typeof valor === "string") {
    const limpo = valor.trim()
    return limpo ? limpo : undefined
  }

  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor)
  }

  return undefined
}


/** O motivo que a plataforma deu. Nunca busca às cegas. Formatos: doc 15. */
export function lerDetalhe(corpo: unknown): string | undefined {
  if (typeof corpo === "string") {
    const texto = textoDe(corpo)
    return texto ? texto.slice(0, MAX_DETALHE) : undefined
  }

  if (!corpo || typeof corpo !== "object") {
    return undefined
  }

  const alvo = corpo as Record<string, unknown>

  for (const campo of ["message", "error", "details", "detail", "description"]) {
    const direto = textoDe(alvo[campo])

    if (direto) {
      return direto.slice(0, MAX_DETALHE)
    }

    // `error` e `details` podem vir como objeto (`{ error: { message } }`).
    if (alvo[campo] && typeof alvo[campo] === "object") {
      const aninhado = lerDetalhe(alvo[campo])

      if (aninhado) {
        return aninhado
      }
    }
  }

  for (const campo of ["errors", "details"]) {
    const lista = alvo[campo]

    if (Array.isArray(lista)) {
      // `details` em lista é validação por campo: quem formata é a de baixo.
      const partes =
        campo === "errors"
          ? lista
              .map((item) => textoDe(item) ?? textoDe((item as any)?.message))
              .filter((item): item is string => Boolean(item))
              .slice(0, 3)
          : []

      if (partes.length > 0) {
        return partes.join("; ").slice(0, MAX_DETALHE)
      }
    }
  }

  return detalheDeValidacao(alvo)
}

/** O `{ "from": ["cep inválido"] }` da calculadora. Só listas contam. */
const CAMPOS_DE_METADADO = new Set([
  "error",
  "errors",
  "message",
  "status",
  "statuscode",
  "code",
  "type",
  "id",
  "name",
])

function detalheDeValidacao(corpo: Record<string, unknown>): string | undefined {
  const partes: string[] = []

  for (const [campo, conteudo] of Object.entries(corpo)) {
    if (!Array.isArray(conteudo) || CAMPOS_DE_METADADO.has(campo.toLowerCase())) {
      continue
    }

    const recados = conteudo
      .map((item) => textoDe(item))
      .filter((item): item is string => Boolean(item))

    if (recados.length > 0) {
      partes.push(`${campo}: ${recados.join("; ")}`)
    }

    if (partes.length === 3) {
      break
    }
  }

  return partes.length > 0 ? partes.join(" · ").slice(0, MAX_DETALHE) : undefined
}

export type EntradaDaMensagem = {
  plataforma: string
  status: number
  detalhe?: string
  /** Segundos, só para o 504. */
  limiteSegundos?: number
  /** O que o operador deve conferir, quando é problema nosso. */
  dica?: string
}

function classificacaoDe(plataforma: string, status: number, limiteSegundos?: number): string {
  switch (codigoDoStatus(status)) {
    case "CREDENCIAL":
      return `o ${plataforma} recusou a credencial`

    case "DADOS":
      return `o ${plataforma} recusou os dados`

    case "NAO_ENCONTRADO":
      return `o ${plataforma} não encontrou o recurso pedido`

    case "LIMITE":
      return `o ${plataforma} recusou por limite de chamadas; tente de novo em instantes`

    case "TEMPO":
      return `o ${plataforma} não respondeu${
        limiteSegundos ? ` em ${limiteSegundos}s` : ""
      }`

    case "SEM_RESPOSTA":
      return `não foi possível falar com o ${plataforma}`

    default:
      return `o ${plataforma} respondeu HTTP ${status}`
  }
}

/** O motivo da plataforma primeiro; o genérico depois (ou como fallback). */
export function mensagemDe({
  plataforma,
  status,
  detalhe,
  limiteSegundos,
  dica,
}: EntradaDaMensagem): string {
  const classificacao = classificacaoDe(plataforma, status, limiteSegundos)
  const frase = detalhe ? `${detalhe} — ${classificacao}.` : `${classificacao}.`

  return dica ? `${frase} ${dica}` : frase
}

export type EntradaDaFalha = {
  plataforma: string
  operacao: string
  /** O status HTTP; `STATUS_SEM_RESPOSTA` quando o `fetch` lançou. */
  status: number
  /** Corpo já interpretado, se houve. */
  corpo?: unknown
  /** Corpo cru, para o caso não-JSON. */
  textoCru?: string
  limiteSegundos?: number
  dica?: string
}

/** A resposta de erro pronta para `throw`. Corpo não-JSON vira só o tamanho. */
export function classificarFalha({
  plataforma,
  operacao,
  status,
  corpo,
  textoCru,
  limiteSegundos,
  dica,
}: EntradaDaFalha): ErroDePlataforma {
  const daPlataforma =
    lerDetalhe(corpo) ??
    (corpo === undefined && textoCru
      ? `resposta não-JSON, ${textoCru.length} bytes`
      : undefined)

  return new ErroDePlataforma({
    plataforma,
    operacao,
    status,
    codigo: codigoDoStatus(status),
    detalhe: corpo === undefined ? undefined : semPii(corpo),
    mensagem: mensagemDe({
      plataforma,
      status,
      detalhe: daPlataforma,
      limiteSegundos,
      dica,
    }),
  })
}
