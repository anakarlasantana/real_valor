

import { apenasDigitos } from "./catalogo"

/** `producao` é opt-in: saldo real não pode sair por engano. */
export type AmbienteSuperFrete = "sandbox" | "producao"

const BASES: Record<AmbienteSuperFrete, string> = {
  sandbox: "https://sandbox.superfrete.com",
  producao: "https://api.superfrete.com",
}

export function ambienteDaConfig(valor: unknown): AmbienteSuperFrete {
  return String(valor ?? "").trim().toLowerCase() === "producao"
    ? "producao"
    : "sandbox"
}

export function baseDaApi(ambiente: AmbienteSuperFrete): string {
  return BASES[ambiente]
}

/**
 * Obrigatório: sem ele a API recusa.
 *
 * A doc (`superfrete.readme.io`) pede o formato **"Nome e versão da aplicação
 * (email para contato técnico)"** — é por ele que a SuperFrete avisa de mudança
 * na API. `SUPERFRETE_USER_AGENT` sobrepõe, para quando o contato técnico mudar
 * sem precisar de deploy.
 */
export const USER_AGENT_PADRAO = "RealValor v1.0.0 (userealvalor@gmail.com)"

export function userAgent(): string {
  const doAmbiente = process.env.SUPERFRETE_USER_AGENT?.trim()

  return doAmbiente || USER_AGENT_PADRAO
}

/** Compatibilidade: quem importava a constante continua funcionando. */
export const USER_AGENT = USER_AGENT_PADRAO

/** 401 tem recado próprio — e o token nunca é ecoado no log. */
export class ErroSuperFrete extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: string
  ) {
    super(message)
    this.name = "ErroSuperFrete"
  }
}


export async function chamarSuperFrete<T>({
  ambiente,
  token,
  caminho,
  metodo = "GET",
  corpo,
  timeoutMs = 15_000,
}: {
  ambiente: AmbienteSuperFrete
  token: string
  caminho: string
  metodo?: "GET" | "POST" | "DELETE"
  corpo?: unknown
  timeoutMs?: number
}): Promise<T> {
  if (!token) {
    throw new ErroSuperFrete(
      "O SuperFrete não está configurado (SUPERFRETE_TOKEN vazio).",
      503
    )
  }

  const resposta = await fetch(`${baseDaApi(ambiente)}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent(),
      accept: "application/json",
      ...(corpo ? { "content-type": "application/json" } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    // Sem prazo, uma API lenta segura o checkout inteiro.
    signal: AbortSignal.timeout(timeoutMs),
  })

  const texto = await resposta.text()
  const json = texto ? safeJson(texto) : undefined

  if (!resposta.ok) {
    const detalhe =
      (json as any)?.message ?? (json as any)?.error ?? (json as any)?.details

    if (resposta.status === 401 || resposta.status === 403) {
      throw new ErroSuperFrete(
        "O SuperFrete recusou o token. Confira o SUPERFRETE_TOKEN e o SUPERFRETE_AMBIENTE.",
        resposta.status
      )
    }

    throw new ErroSuperFrete(
      typeof detalhe === "string" && detalhe
        ? `SuperFrete: ${detalhe}`
        : `SuperFrete respondeu ${resposta.status}${resumoDe(texto)}.`,
      resposta.status
    )
  }

  return json as T
}

function safeJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}

/**
 * Um 400 da calculadora vem com o corpo de validação (`{"from": ["..."}}`), que
 * não tem `message`/`error`/`details`. Sem ele, sobra só "respondeu 400" e o
 * payload errado fica invisível.
 */
function resumoDe(texto: string): string {
  const corpo = texto.trim()

  if (!corpo) {
    return ""
  }

  const curto = corpo.length > 300 ? `${corpo.slice(0, 300)}…` : corpo

  return ` — ${curto}`
}

export { apenasDigitos }
