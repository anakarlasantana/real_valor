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
  fetchImpl?: typeof fetch
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * O que um 404 significa **neste** provedor: "este CEP não existe" no ViaCEP e na
 * BrasilAPI, "esta rota não existe" no nosso proxy — deploy antigo, não um CEP.
 */
type Status404 = "inexistente" | "fora"

type Provedor = readonly [
  url: string,
  ler: (corpo: unknown) => ResultadoCep | "fora",
  status404: Status404,
]

/** Proxy do servidor: mesma origem, sem CORS. */
const PROXY_CEP = "/api/cep"

const VIACEP = "https://viacep.com.br/ws"
const BRASILAPI = "https://brasilapi.com.br/api/cep/v2"

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : ""
}

/** No navegador usamos o proxy (mesma origem, sem CORS); no servidor, fetch direto. */
function ehNavegador(): boolean {
  return typeof window !== "undefined"
}

/** Prazo estourado ou quem chamou desistiu: esperado, não é defeito. */
function ehAbort(erro: unknown): boolean {
  return (erro as { name?: string } | null)?.name === "AbortError"
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
 * Uma consulta, com prazo. `"fora"` = rede, tempo ou formato estranho.
 */
async function consultar(
  url: string,
  ler: (corpo: unknown) => ResultadoCep | "fora",
  config: { fetchImpl: typeof fetch; timeoutMs: number; signal?: AbortSignal },
  status404: Status404
): Promise<ResultadoCep | "fora"> {
  const controle = new AbortController()
  const encerrar = () => controle.abort()
  const prazo = setTimeout(encerrar, config.timeoutMs)
  config.signal?.addEventListener("abort", encerrar, { once: true })

  try {
    // **Solto, não como método**: `config.fetchImpl(url)` passa `config` como
    // `this`, e o `fetch` do navegador recusa com `Illegal invocation` (RV-041).
    const buscar = config.fetchImpl
    const resposta = await buscar(url, {
      headers: { Accept: "application/json" },
      signal: controle.signal,
    })

    // 404 é resposta do provedor, não falha: o CEP não existe (ou falta a rota).
    if (resposta.status === 404) {
      return status404 === "inexistente"
        ? { encontrado: false, motivo: "cep-inexistente" }
        : "fora"
    }

    if (!resposta.ok) return "fora"

    return ler(await resposta.json())
  } catch (erro) {
    // Prazo e desistência são esperados; o resto (o `Illegal invocation`) sumia sem log.
    if (!ehAbort(erro) && process.env.NODE_ENV !== "production") {
      console.warn("[cep] falha ao consultar", url, erro)
    }

    return "fora"
  } finally {
    clearTimeout(prazo)
    config.signal?.removeEventListener("abort", encerrar)
  }
}

/** Busca o endereço de um CEP, em cascata, sem nunca lançar. */
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

  // No navegador, o proxy da mesma origem evita o CORS do ViaCEP.
  const urls: readonly Provedor[] = ehNavegador()
    ? [[`${PROXY_CEP}/${digitos}`, doProxy, "fora"]]
    : [
        [`${VIACEP}/${digitos}/json/`, doViaCep, "inexistente"],
        [`${BRASILAPI}/${digitos}`, daBrasilApi, "inexistente"],
      ]

  for (const [url, ler, status404] of urls) {
    // Quem chamou desistiu (a cliente saiu do checkout): nem começa o próximo.
    if (config.signal?.aborted) break

    const resultado = await consultar(url, ler, config, status404)

    // "Não existe" é resposta: não vale gastar mais 2,5s no segundo provedor (RV-038).
    if (resultado !== "fora") return resultado
  }

  return { encontrado: false, motivo: "provedor-fora" }
}
