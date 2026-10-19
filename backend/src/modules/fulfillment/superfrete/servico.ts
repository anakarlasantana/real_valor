
import {
  PESO_MAXIMO_GRAMAS,
  corpoDaCotacao,
  cepValido,
  lerCotacoes,
  paraQuilos,
  servicosOrdenados,
  servicosQueAceitam,
  type CorpoDaCotacao,
  type Cotacao,
  type Servico,
} from "./catalogo"

/** A mensagem não pode dizer "Correios" quando o serviço pedido é outra. */
export function semEntrega(asServicos: Servico[]): string {
  return asServicos.length === 1
    ? `Não há entrega por este serviço para este CEP e este peso.`
    : "Não há entrega para este CEP e este peso."
}
import { caixaDoEnvio } from "./etiqueta"
import { pesoTaxavel, type Pacote } from "../pacotes/pacotes"
import { PACOTES_MODULE } from "../pacotes"
import type PacotesModuleService from "../pacotes/service"
import type { ItemDoPedido } from "../pacotes/volumes"
import type { chamarSuperFrete } from "./cliente"

export type Chamar = typeof chamarSuperFrete

export type ConfigSuperFrete = { token: string; ambiente: "sandbox" | "producao" }

export const VALIDADE_CACHE_MS = 5 * 60 * 1000

/** L1 (memória): o checkout repete a mesma pergunta em segundos. */
export const VALIDADE_MEMORIA_MS = 60 * 1000

/** L2 (Redis): sobrevive ao restart e é compartilhado entre workers. */
export const VALIDADE_REDIS_S = 300

const memoria = new Map<string, { em: number; cotacoes: Cotacao[] }>()

/** O que o `Modules.CACHE` do Medusa oferece (`ICacheService`) — só o que usamos. */
type CacheCompartilhado = {
  get: <T = unknown>(key: string) => Promise<T | null>
  set: (key: string, data: unknown, ttl?: number) => Promise<void>
  /** Apaga as chaves que casam com o padrão (`cotacao*`), nunca o banco inteiro. */
  invalidate: (key: string) => Promise<void>
}

/**
 * O prefixo de todas as chaves da cotação. A invalidação apaga **só** isto:
 * `clear()` no Redis é `FLUSHDB`, e o Redis do Medusa também guarda as sessões
 * do painel (`sess:`) — limpar tudo derrubaria o login de todo mundo.
 */
const PREFIXO_DA_COTACAO = "cotacao"

let cacheCompartilhado: CacheCompartilhado | null = null

/**
 * Uma invalidação pode chegar antes de o cache existir (nenhuma cotação ainda
 * passou pelo container). Sem a marca, o Redis guardaria o preço antigo.
 */
let compartilhadoSujo = false

/** Cotação em andamento: duas requisições iguais não chamam a API duas vezes. */
const emAndamento = new Map<string, Promise<Cotacao[]>>()

/**
 * O `Modules.CACHE` do Medusa, quando o `medusa-config` o registrou (Redis em
 * produção, memória fora dele). Ausente = só a L1, e nada quebra.
 */
export function registrarCache(container?: {
  resolve: (chave: string) => unknown
}): void {
  if (!container) {
    return
  }

  try {
    // `Modules.CACHE` é a string "cache"; importar o enum criaria ciclo.
    const encontrado = container.resolve("cache") as
      | CacheCompartilhado
      | undefined

    if (!encontrado || typeof encontrado.get !== "function") {
      return
    }

    cacheCompartilhado = encontrado

    if (compartilhadoSujo) {
      compartilhadoSujo = false
      void encontrado.invalidate(`${PREFIXO_DA_COTACAO}*`).catch(() => undefined)
    }
  } catch {
    cacheCompartilhado = null
  }
}

export type OrigemDoCache = "rede" | "memoria" | "redis"

export type ResultadoCotacao =
  | {
      ok: true
      cotacoes: Cotacao[]
      volumes: number
      pesoGramas: number
      origem: OrigemDoCache
    }
  | { ok: false; erro: string; status: number; origem: OrigemDoCache }

/** O que foi pedido à API — é o que a tela do admin mostra para auditar. */
export type RequisicaoDaCotacao = {
  metodo: "POST"
  url: string
  caminho: string
  cabecalhos: Record<string, string>
  corpo: CorpoDaCotacao
}

/**
 * A chave do cache. Só o que muda o preço entra nela: ambiente (sandbox e
 * produção têm tarifas diferentes), CEPs, peso e medidas **arredondados** (o
 * float de 0,30000000000000004 não pode criar outra chave) e os serviços em
 * ordem de catálogo.
 */
export function chaveDaCotacao({
  config,
  cepOrigem,
  cepDestino,
  volume,
  servicos,
}: {
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  volume: {
    peso_gramas: number
    altura_cm: number
    largura_cm: number
    comprimento_cm: number
  }
  servicos: Servico[]
}): string {
  const medida = (valor: unknown) => Math.round((Number(valor) || 0) * 1000) / 1000
  const lados = [volume.altura_cm, volume.largura_cm, volume.comprimento_cm]
    .map(medida)
    .join("x")

  return [
    "cotacao",
    config.ambiente,
    cepOrigem,
    cepDestino,
    `${medida(volume.peso_gramas)}:${lados}`,
    servicosOrdenados(servicos).join(","),
  ].join("|")
}

function daMemoria(chave: string): Cotacao[] | null {
  const guardado = memoria.get(chave)

  if (!guardado) {
    return null
  }

  if (Date.now() - guardado.em >= VALIDADE_MEMORIA_MS) {
    memoria.delete(chave)
    return null
  }

  return guardado.cotacoes
}

async function doCompartilhado(chave: string): Promise<Cotacao[] | null> {
  if (!cacheCompartilhado) {
    return null
  }

  try {
    const guardado = await cacheCompartilhado.get<Cotacao[]>(chave)

    return Array.isArray(guardado) && guardado.length > 0 ? guardado : null
  } catch {
    // Redis fora do ar não derruba a cotação: cai para a rede.
    return null
  }
}

/** Preenche as duas camadas; falha de cache é silenciosa e nunca vira erro. */
async function guardar(chave: string, cotacoes: Cotacao[]): Promise<void> {
  memoria.set(chave, { em: Date.now(), cotacoes })

  if (!cacheCompartilhado) {
    return
  }

  try {
    await cacheCompartilhado.set(chave, cotacoes, VALIDADE_REDIS_S)
  } catch {
    // A L1 já guardou; o Redis é ganho, não requisito.
  }
}


export async function cotarPedido({
  container,
  config,
  cepOrigem,
  cepDestino,
  itens,
  servicos,
  chamar,
  force = false,
}: {
  container: { resolve: (chave: string) => unknown }
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  itens: ItemDoPedido[]
  servicos: Servico[]
  // Injetável: o teste não toca a rede.
  chamar: typeof chamarSuperFrete
  /** O teste do admin: pula as duas camadas e mede a API de verdade. */
  force?: boolean
}): Promise<ResultadoCotacao> {
  if (!cepValido(cepOrigem)) {
    return {
      ok: false,
      status: 422,
      origem: "rede",
      erro: "O CEP de origem não está configurado. Configure o endereço do centro de distribuição.",
    }
  }

  if (!cepValido(cepDestino)) {
    return {
      ok: false,
      status: 400,
      origem: "rede",
      erro: "Informe um CEP de destino válido.",
    }
  }

  registrarCache(container)

  const pacotes = container.resolve(PACOTES_MODULE) as PacotesModuleService
  const calculo = await pacotes.volumesDoPedido(itens)

  if (!calculo.ok) {
    return { ok: false, status: 422, origem: "rede", erro: calculo.motivo }
  }

  const pedidos = servicosOrdenados(servicos)

  if (pedidos.length === 0) {
    return {
      ok: false,
      status: 422,
      origem: "rede",
      erro: "Nenhum serviço de entrega selecionado para cotar.",
    }
  }

  const volume = calculo.volumes[0]

  // Cada caixa é cobrada: o total, senão o checkout mostra metade.
  const multiplicar = (cotacoes: Cotacao[]) =>
    cotacoes.map((cotacao) => ({
      ...cotacao,
      preco: cotacao.preco * calculo.volumes.length,
    }))

  const pronto = (
    cotacoes: Cotacao[],
    origem: OrigemDoCache
  ): ResultadoCotacao => ({
    ok: true,
    cotacoes,
    volumes: calculo.volumes.length,
    pesoGramas: calculo.pesoGramas,
    origem,
  })

  const chave = chaveDaCotacao({
    config,
    cepOrigem,
    cepDestino,
    volume,
    servicos: pedidos,
  })

  if (!force) {
    const local = daMemoria(chave)

    if (local) {
      return pronto(local, "memoria")
    }

    const compartilhado = await doCompartilhado(chave)

    if (compartilhado) {
      // O Redis guardou o unitário; o total é desta requisição.
      const total = multiplicar(compartilhado)
      memoria.set(chave, { em: Date.now(), cotacoes: total })

      return pronto(total, "redis")
    }

    const emVoo = emAndamento.get(chave)

    // A mesma pergunta já está na API: espera em vez de duplicar a chamada.
    if (emVoo) {
      try {
        return pronto(multiplicar(await emVoo), "memoria")
      } catch (erro: any) {
        return {
          ok: false,
          status: Number(erro?.status) || 502,
          origem: "rede",
          erro: erro?.message ?? "O cálculo de frete falhou.",
        }
      }
    }
  }

  // Serviço que não aceita o peso não vai à API: voltaria `has_error`.
  const { aceitos, recusados } = servicosQueAceitam({
    servicos: pedidos,
    pesoGramas: volume.peso_gramas,
  })

  if (aceitos.length === 0) {
    const teto = Math.max(
      ...recusados.map((servico) => PESO_MAXIMO_GRAMAS[servico])
    )

    return {
      ok: false,
      status: 422,
      origem: "rede",
      erro: `O peso de ${paraQuilos(volume.peso_gramas)} kg passa do limite de ${teto / 1000} kg desta transportadora.`,
    }
  }

  // A chave do resultado útil é a dos serviços que de fato foram cotados: pedir
  // "todos" e "todos menos a J&T" com 20 kg é a mesma pergunta para a API.
  const chaveUtil = chaveDaCotacao({
    config,
    cepOrigem,
    cepDestino,
    volume,
    servicos: aceitos,
  })

  const promessa = (async () => {
    const resposta = await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/calculator",
      metodo: "POST",
      corpo: corpoDaCotacao({
        cepOrigem,
        cepDestino,
        volume,
        servicos: aceitos,
      }),
    })

    const cotacoes = lerCotacoes(resposta)

    if (cotacoes.length === 0) {
      // Erro, não cache: `has_error` pode ser temporário do lado da API.
      throw Object.assign(new Error(semEntrega(aceitos)), { status: 422 })
    }

    await guardar(chaveUtil, cotacoes)

    return cotacoes
  })()

  emAndamento.set(chave, promessa)

  try {
    return pronto(multiplicar(await promessa), "rede")
  } catch (erro: any) {
    // A falha não entra no cache: um 5xx não pode ficar grudado por 5 min.
    return {
      ok: false,
      status: Number(erro?.status) || 502,
      origem: "rede",
      erro: erro?.message ?? "O cálculo de frete falhou.",
    }
  } finally {
    emAndamento.delete(chave)
  }
}


/** O que foi enviado, com o token mascarado — vira "Copiar como cURL" na tela. */
export function requisicaoDaCotacao({
  config,
  cepOrigem,
  cepDestino,
  volume,
  servicos,
  base,
  userAgent,
}: {
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  volume: {
    peso_gramas: number
    altura_cm: number
    largura_cm: number
    comprimento_cm: number
  }
  servicos: Servico[]
  base: string
  userAgent: string
}): RequisicaoDaCotacao {
  const caminho = "/api/v0/calculator"

  return {
    metodo: "POST",
    url: `${base}${caminho}`,
    caminho,
    cabecalhos: {
      // O token nunca sai do servidor, nem para a tela do admin.
      Authorization: "Bearer ••••••••",
      "User-Agent": userAgent,
      accept: "application/json",
      "content-type": "application/json",
    },
    corpo: corpoDaCotacao({ cepOrigem, cepDestino, volume, servicos }),
  }
}

export type ResultadoTeste = {
  ok: boolean
  erro?: string
  /** HTTP a devolver na falha (o caso de sucesso é sempre 200). */
  status?: number
  cotacoes: Cotacao[]
  volumes: number
  pesoGramas: number
  /** Sempre `rede`: o teste pula as duas camadas de cache. */
  origem: OrigemDoCache
  requisicao: RequisicaoDaCotacao
  latenciaMs: number
}

/**
 * A cotação de teste: a mesma caixa padrão do checkout, **sem cache** e sem
 * gravar nada. A requisição vai na resposta para o admin conferir o corpo
 * enviado sem abrir o log do servidor.
 */
export async function testarCotacao({
  config,
  cepOrigem,
  cepDestino,
  caixas,
  servicos,
  chamar,
  base,
  userAgent,
  relogio = () => Date.now(),
}: {
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  caixas: Pacote[]
  servicos: Servico[]
  chamar: Chamar
  base: string
  userAgent: string
  /** Injetável: o teste não depende do relógio real. */
  relogio?: () => number
}): Promise<ResultadoTeste> {
  const inicio = relogio()
  const gasto = () => Math.max(0, relogio() - inicio)
  const caixa = caixaDoEnvio(caixas)

  // Sem caixa e sem CEP válido: a requisição aparece com o que daria para montar.
  const volume = {
    peso_gramas: caixa ? pesoTaxavel(caixa) : 0,
    altura_cm: Number(caixa?.altura_cm ?? 0),
    largura_cm: Number(caixa?.largura_cm ?? 0),
    comprimento_cm: Number(caixa?.comprimento_cm ?? 0),
  }
  const requisicao = requisicaoDaCotacao({
    config,
    cepOrigem,
    cepDestino,
    volume,
    servicos,
    base,
    userAgent,
  })
  const desistir = (status: number, erro: string): ResultadoTeste => ({
    ok: false,
    erro,
    status,
    cotacoes: [],
    volumes: 0,
    pesoGramas: 0,
    origem: "rede",
    requisicao,
    latenciaMs: gasto(),
  })

  if (!cepValido(cepOrigem)) {
    return desistir(
      422,
      "O CEP de origem não está configurado. Configure o endereço do centro de distribuição."
    )
  }

  if (!cepValido(cepDestino)) {
    return desistir(400, "Informe um CEP de destino válido.")
  }

  if (!caixa) {
    return desistir(422, "Nenhuma caixa ativa e válida para cotar.")
  }

  try {
    const resposta = await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/calculator",
      metodo: "POST",
      corpo: requisicao.corpo,
    })
    const cotacoes = lerCotacoes(resposta)

    if (cotacoes.length === 0) {
      return desistir(422, semEntrega(servicos))
    }

    return {
      ok: true,
      cotacoes,
      volumes: 1,
      pesoGramas: volume.peso_gramas,
      origem: "rede",
      requisicao,
      latenciaMs: gasto(),
    }
  } catch (erro: any) {
    return desistir(
      Number(erro?.status) || 502,
      erro?.message ?? "O cálculo de frete falhou."
    )
  }
}


/** Só a L1 — usada nos testes. A L2 é limpa por `invalidarCache`. */
export function limparCache(): void {
  memoria.clear()
  emAndamento.clear()
  compartilhadoSujo = false
}

/**
 * Caixa ou serviço mudou: nenhuma cotação guardada vale mais.
 *
 * As duas camadas são limpas: manter o Redis com o preço antigo faria a
 * alteração da tela demorar até 5 min para aparecer no checkout.
 */
export async function invalidarCache(): Promise<void> {
  limparCache()

  if (!cacheCompartilhado) {
    compartilhadoSujo = true
    return
  }

  try {
    await cacheCompartilhado.invalidate(`${PREFIXO_DA_COTACAO}*`)
  } catch {
    // Sem Redis a L1 já foi; a L2 expira sozinha.
  }
}
