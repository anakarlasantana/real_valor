/**
 * O endereço de um CEP: ViaCEP e, se ele falhar, BrasilAPI. Nunca lança — CEP
 * opcional não derruba o checkout. Ver RV-038 em `19-debito-tecnico.md`.
 */
import { apenasDigitos, CEP_DIGITOS } from "@rv/contrato"
import type { EnderecoDoCep, ResultadoCep } from "@rv/contrato"

export type {
  EnderecoDoCep,
  MotivoSemEndereco,
  ResultadoCep,
} from "@rv/contrato"

/** Curto: não pode segurar o campo. */
export const TIMEOUT_CEP_MS = 2500

export type OpcoesBusca = {
  /** Para o teste. Em produção, o `fetch` do navegador. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
  signal?: AbortSignal
}

type Provedor = readonly [
  url: string,
  ler: (corpo: unknown) => ResultadoCep | "fora",
]

/** Proxy do servidor: mesma origem, sem CORS. */
const PROXY_CEP = "/api/cep"

const VIACEP = "https://viacep.com.br/ws"
const BRASILAPI = "https://brasilapi.com.br/api/cep/v2"

/** `null`/`""` viram `""`: bairro vazio de alguns CEPs não é valor. */
function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : ""
}

/** No navegador usamos o proxy (mesma origem, sem CORS); no servidor, fetch direto. */
function ehNavegador(): boolean {
  return typeof window !== "undefined"
}

/** O proxy devolve o `ResultadoCep` pronto; aqui só conferimos a forma. */
function doProxy(corpo: unknown): ResultadoCep | "fora" {
  if (!corpo || typeof corpo !== "object") return "fora"

  const dados = corpo as Partial<ResultadoCep>

  if (dados.encontrado === false && typeof dados.motivo === "string") {
    return { encontrado: false, motivo: dados.motivo }
  }

  if (dados.encontrado !== true || !dados.endereco) return "fora"

  const { logradouro, bairro, cidade, estado } = dados.endereco

  // Cidade e UF são o que o campo mostra: sem elas, não é endereço.
  if (typeof cidade !== "string" || typeof estado !== "string") return "fora"

  return {
    encontrado: true,
    endereco: {
      logradouro: texto(logradouro),
      bairro: texto(bairro),
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
    },
  }
}

function doViaCep(corpo: unknown): ResultadoCep | "fora" {
  if (!corpo || typeof corpo !== "object") return "fora"

  const dados = corpo as Record<string, unknown>

  if (dados.erro === true || dados.erro === "true") {
    return { encontrado: false, motivo: "cep-inexistente" }
  }

  if (!texto(dados.uf) && !texto(dados.localidade)) return "fora"

  return {
    encontrado: true,
    endereco: {
      logradouro: texto(dados.logradouro),
      bairro: texto(dados.bairro),
      cidade: texto(dados.localidade),
      estado: texto(dados.uf).toUpperCase(),
    },
  }
}

/** `{ cep, state, city, neighborhood, street }`: `street` pode vir vazio. */
function daBrasilApi(corpo: unknown): ResultadoCep | "fora" {
  if (!corpo || typeof corpo !== "object") return "fora"

  const dados = corpo as Record<string, unknown>

  if (Array.isArray(dados.errors) && dados.errors.length > 0) {
    return { encontrado: false, motivo: "cep-inexistente" }
  }

  if (!texto(dados.state) && !texto(dados.city)) return "fora"

  return {
    encontrado: true,
    endereco: {
      logradouro: texto(dados.street),
      bairro: texto(dados.neighborhood),
      cidade: texto(dados.city),
      estado: texto(dados.state).toUpperCase(),
    },
  }
}

/**
 * Uma consulta, com prazo. `"fora"` = rede, tempo ou formato estranho: os três
 * valem "tenta o próximo". O abort fecha a conexão quando o prazo estoura.
 */
async function consultar(
  url: string,
  ler: (corpo: unknown) => ResultadoCep | "fora",
  config: { fetchImpl: typeof fetch; timeoutMs: number; signal?: AbortSignal }
): Promise<ResultadoCep | "fora"> {
  const controle = new AbortController()
  const encerrar = () => controle.abort()
  const prazo = setTimeout(encerrar, config.timeoutMs)
  config.signal?.addEventListener("abort", encerrar, { once: true })

  try {
    const resposta = await config.fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controle.signal,
    })

    // 404 é resposta do provedor, não falha: o CEP não existe.
    if (resposta.status === 404) {
      return { encontrado: false, motivo: "cep-inexistente" }
    }

    if (!resposta.ok) return "fora"

    return ler(await resposta.json())
  } catch {
    return "fora"
  } finally {
    clearTimeout(prazo)
    config.signal?.removeEventListener("abort", encerrar)
  }
}

/**
 * Busca o endereço de um CEP, em cascata, sem nunca lançar.
 */
export async function buscarCep(
  cep: string | null | undefined,
  opcoes: OpcoesBusca = {}
): Promise<ResultadoCep> {
  const digitos = apenasDigitos(cep).slice(0, CEP_DIGITOS)

  if (digitos.length !== CEP_DIGITOS) {
    return { encontrado: false, motivo: "cep-incompleto" }
  }

  const config = {
    fetchImpl: opcoes.fetchImpl ?? fetch,
    timeoutMs: opcoes.timeoutMs ?? TIMEOUT_CEP_MS,
    signal: opcoes.signal,
  }

  // No navegador, o proxy da mesma origem evita o CORS do ViaCEP; no servidor, fetch direto.
  const urls: readonly Provedor[] = ehNavegador()
    ? [[`${PROXY_CEP}/${digitos}`, doProxy]]
    : [
        [`${VIACEP}/${digitos}/json/`, doViaCep],
        [`${BRASILAPI}/${digitos}`, daBrasilApi],
      ]

  for (const [url, ler] of urls) {
    // Quem chamou desistiu (a cliente saiu do checkout): nem começa o próximo.
    if (config.signal?.aborted) break

    const resultado = await consultar(url, ler, config)

    if (resultado !== "fora") return resultado
  }

  return { encontrado: false, motivo: "provedor-fora" }
}
