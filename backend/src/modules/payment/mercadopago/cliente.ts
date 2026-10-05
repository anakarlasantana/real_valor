/**
 * O cliente HTTP do Mercado Pago.
 * -------------------------------------------------------------------------
 * **Por que não usar o SDK oficial.** O `mercadopago` npm é um cliente
 * completo: preferências, pagamentos, assinaturas, *marketplace*, *split* de
 * comissão, *webhooks* — tudo o que a loja **não** usa. O que a loja usa são
 * **duas** chamadas, e as duas cabem em `fetch`. Um SDK a mais é uma árvore de
 * dependências a mais no container, uma versão a mais para acompanhar e um
 * `client.create(...)` que some do `grep` quando alguém procura "o que a loja
 * manda para o provedor?". Duas funções com nome respondem essa pergunta em
 * dez segundos.
 *
 * **O que este arquivo garante, e é o motivo de existir.** Erro do provedor
 * nunca sai daqui com o corpo cru pendurado na exceção. O corpo do erro do
 * Mercado Pago pode conter eco do que mandamos — e o que mandamos contém o
 * e-mail da cliente. `ErroDoProvedor` carrega o **status** e o detalhe já
 * redigido; quem captura loga os dois sem pensar duas vezes.
 *
 * **O timeout é obrigatório, não opcional.** Sem ele, uma lentidão do provedor
 * vira uma requisição do nosso backend pendurada até o *socket* desistir, e
 * quem está olhando a tela é a cliente. Cinco segundos é o limite do checkout:
 * além disso é melhor dizer "tente novamente" do que continuar esperando.
 */
import { API, ehTokenDeTeste, token } from "./credenciais"
import { semPii } from "./redigir"

/** Quanto esperar o provedor antes de desistir. */
export const TIMEOUT_MS = 5_000

/**
 * Um erro do provedor, já sem dado pessoal.
 *
 * `status` é o do provedor (400, 401, 404...) e `detalhe` é o corpo redigido.
 * A distinção importa para quem trata: um `401` é credencial nossa errada (não
 * adianta retentar), um `500` do provedor é transitório (retentar faz sentido).
 */
export class ErroDoProvedor extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly detalhe?: unknown
  ) {
    super(mensagem)
    this.name = "ErroDoProvedor"
  }
}

/** A resposta de erro do provedor, sem PII e sem corpo gigante. */
function lerErro(corpo: unknown): { erro?: unknown; mensagem?: unknown } {
  const limpo = semPii(corpo)

  if (limpo && typeof limpo === "object") {
    const alvo = limpo as Record<string, unknown>
    return { erro: alvo.error, mensagem: alvo.message }
  }

  return { erro: limpo }
}

/**
 * A chamada crua. Autentica, mede o tempo e normaliza o erro.
 *
 * **Falha alto quando não há token.** Devolver `null` e deixar quem chamou
 * decidir seria repetir, em cada chamada, uma checagem que já existe com
 * mensagem própria em `pagamentoDisponivel`. Aqui uma credencial ausente é erro
 * de programação, não um estado a tratar.
 */
async function chamar<T>(
  caminho: string,
  init: { method: "GET" | "POST"; corpo?: unknown }
): Promise<T> {
  const credencial = token()

  if (!credencial) {
    throw new ErroDoProvedor(
      "O Mercado Pago não está configurado (MP_ACCESS_TOKEN ausente).",
      503
    )
  }

  let resposta: Response

  try {
    resposta = await fetch(`${API}${caminho}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${credencial}`,
        "Content-Type": "application/json",
      },
      body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    // Timeout e queda de rede chegam aqui com tipos diferentes (`AbortError`
    // vs. `TypeError`); o que interessa a quem trata é que **não houve
    // resposta** — um `503` diz exatamente isso e não convida a retentar a
    // mesma preferência.
    throw new ErroDoProvedor(
      "Não foi possível falar com o Mercado Pago.",
      503,
      semPii({ causa: (e as Error)?.name })
    )
  }

  const texto = await resposta.text()
  let corpo: unknown = undefined

  if (texto) {
    try {
      corpo = JSON.parse(texto)
    } catch {
      // O provedor respondeu algo que não é JSON (uma página de erro de proxy,
      // por exemplo). Guarda o formato, nunca o conteúdo: pode vir com HTML de
      // terceiro, e nada do que está ali ajuda a diagnosticar o pagamento.
      corpo = { formato: "não-JSON", tamanho: texto.length }
    }
  }

  if (!resposta.ok) {
    const { erro, mensagem } = lerErro(corpo)

    throw new ErroDoProvedor(
      `O Mercado Pago recusou a chamada (HTTP ${resposta.status}).`,
      resposta.status,
      erro ?? mensagem ?? corpo
    )
  }

  return corpo as T
}

/** O que o provedor devolve ao criar uma preferência. */
export type PreferenciaCriada = {
  id?: string
  init_point?: string
  sandbox_init_point?: string
}

/**
 * O `init_point` que a cliente deve abrir.
 *
 * Com credencial de **teste**, o Mercado Pago espera que se use
 * `sandbox_init_point` — é o endereço do ambiente de teste. Mandar a cliente
 * para o `init_point` de uma preferência criada com credencial de teste leva a
 * um checkout que não processa. A escolha é feita pela cara do token, e não por
 * uma variável de ambiente, justamente para não existir um jeito de as duas
 * discordarem.
 */
export function pontoDeInicio(
  preferencia: PreferenciaCriada
): string | undefined {
  if (ehTokenDeTeste()) {
    return preferencia.sandbox_init_point || preferencia.init_point
  }

  return preferencia.init_point || preferencia.sandbox_init_point
}

/** Cria a preferência e devolve o que ela traz. */
export function criarPreferencia(
  documento: Record<string, unknown>
): Promise<PreferenciaCriada> {
  return chamar<PreferenciaCriada>("/checkout/preferences", {
    method: "POST",
    corpo: documento,
  })
}

/**
 * Busca o pagamento pelo id.
 *
 * **Esta chamada é a fonte de verdade do módulo.** O corpo da notificação diz
 * "houve um evento no pagamento X" e nada mais — nem valor, nem status, nem se
 * aquilo é real. O status *de verdade* é o que a API responde, e é esse
 * documento (e só ele) que decide se um pedido nasce. É a diferença entre
 * "alguém disse que pagou" e "o provedor confirma que pagou".
 */
export function buscarPagamento(
  id: string | number
): Promise<Record<string, unknown>> {
  return chamar<Record<string, unknown>>(
    `/v1/payments/${encodeURIComponent(String(id))}`,
    { method: "GET" }
  )
}

/**
 * Os pagamentos de uma referência — normalmente zero ou um.
 *
 * **Por que a busca e não o id.** No Checkout Pro, o id do pagamento **não
 * existe** quando a sessão é criada: primeiro vem a preferência, e o pagamento
 * só nasce quando a cliente paga. Então "qual é o pagamento desta sessão?" não
 * tem resposta por id — só pela referência que nós mesmos escrevemos na
 * preferência. É o mesmo `external_reference`, usado na direção contrária.
 *
 * **O `results` vazio é uma resposta, e não um erro.** Significa "ainda não há
 * pagamento", que é o estado normal de quem abriu o checkout e não pagou. Tratar
 * isso como falha faria a tela de confirmação mostrar erro para quem só está
 * pensando.
 *
 * Devolve sempre uma lista — inclusive quando o provedor responde algo com
 * forma inesperada, e nesse caso `[]`. Uma estrutura que muda de forma não pode
 * virar `undefined.map` no meio de um webhook.
 */
export async function buscarPorReferencia(
  referencia: string
): Promise<Record<string, unknown>[]> {
  const resposta = await chamar<{ results?: unknown }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(referencia)}`,
    { method: "GET" }
  )

  const resultados = resposta?.results

  return Array.isArray(resultados)
    ? (resultados.filter((r) => r && typeof r === "object") as Record<
        string,
        unknown
      >[])
    : []
}
