/**
 * A assinatura das notificações do Mercado Pago.
 * -------------------------------------------------------------------------
 * **Por que isto existe, se o Medusa já tem webhook.** Porque o webhook do
 * Medusa é um **repassador**: ele entrega ao provider o corpo que chegou e
 * confia no que o provider responder. Nada entre o fio e o banco prova que a
 * requisição veio do Mercado Pago — e "alguém mandou um POST dizendo que o
 * pedido está pago" é, sem esta verificação, literalmente tudo o que é preciso
 * para criar um pedido pago de graça. Este arquivo é a única coisa que separa
 * as duas coisas.
 *
 * **O que o Mercado Pago assina.** Não é o corpo. É um *manifesto* montado com
 * três pedaços da **requisição**:
 *
 * ```
 * id:{data.id};request-id:{x-request-id};ts:{ts};
 * ```
 *
 * — o `data.id` vindo do **corpo** (e em **minúsculas**, detalhe que custa uma
 * tarde), o `x-request-id` vindo do **header** e o `ts` vindo do **próprio
 * header de assinatura**. O HMAC-SHA256 desse texto, com o segredo da
 * aplicação, é o `v1` que chega em `x-signature`.
 *
 * **Duas variantes, e por quê.** O `request-id` é omitido do manifesto quando
 * o header não vem. Como a documentação do Mercado Pago descreve as duas
 * formas em lugares diferentes, este módulo monta as duas e aceita se
 * **qualquer uma** conferir. É o mesmo raciocínio dos dois segredos em
 * `credenciais.ts`: uma tentativa a mais não enfraquece nada — quem não tem o
 * segredo não passa em nenhuma — e cobre a incerteza da documentação sem
 * escolher arbitrariamente um lado.
 *
 * **Por que a comparação é `timingSafeEqual`.** Comparar com `===` sai no
 * primeiro byte diferente, e o tempo até sair conta quantos bytes acertaram:
 * repetindo a chamada, dá para descobrir a assinatura byte a byte sem nunca
 * conhecer o segredo. Não é teoria — é o ataque clássico contra HMAC mal
 * comparado, e é por isso que a comparação aqui é a mesma técnica do
 * `frontend/src/app/api/revalidate/route.ts`.
 *
 * **Este arquivo é puro.** Não lê ambiente, não faz I/O, não conhece o Medusa.
 * É o que permite testar a regra — inclusive os casos de borda que decidem se
 * um atacante passa — sem subir nada.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** O header com o HMAC. */
export const HEADER_ASSINATURA = "x-signature"

/** O header com o id da requisição, que entra no manifesto. */
export const HEADER_REQUISICAO = "x-request-id"

/** O que o header `x-signature` traz, já separado. */
export type AssinaturaLida = {
  /** O carimbo de tempo, **como veio**. */
  ts: string
  /** O HMAC em hexadecimal. */
  v1: string
}

/**
 * Por que uma assinatura foi recusada.
 *
 * É um valor **fechado** e não uma mensagem porque cada motivo leva a uma ação
 * diferente de quem opera a loja, e a mais importante é a distinção entre
 * "não temos segredo" e "o segredo não confere": a primeira é configuração
 * nossa, a segunda é ou um segredo trocado ou alguém tentando entrar. Um
 * `false` só não permite distinguir nem uma nem outra.
 */
export type MotivoDaRecusa =
  | "sem_header"
  | "header_malformado"
  | "sem_segredo"
  | "sem_id"
  | "fora_da_janela"
  | "assinatura_invalida"

/** O veredito. `true` traz o manifesto que conferiu, para a trilha de auditoria. */
export type Veredito =
  | { ok: true; ts: string; manifesto: string }
  | { ok: false; motivo: MotivoDaRecusa }

/**
 * Lê o header `x-signature` no formato `ts=1700000000,v1=abc123...`.
 *
 * **Devolve `null` em vez de lançar**, e a diferença importa: um header ausente
 * (requisição sem assinatura nenhuma) e um header presente mas quebrado
 * (alguém chutando) são o mesmo "não passa", mas não são o mesmo evento — o
 * primeiro é rotina, o segundo é sinal. Quem chama decide o que fazer, e o
 * `null` deixa essa decisão fora daqui.
 *
 * A ordem das partes não é garantida pela documentação, então a leitura
 * percorre tudo — e o valor guarda o resto depois do primeiro `=` de propósito:
 * um `v1` contendo `=` não pode ser truncado num `split` ingênuo.
 */
export function lerAssinatura(header: unknown): AssinaturaLida | null {
  if (typeof header !== "string" || !header.trim()) {
    return null
  }

  const partes: Record<string, string> = {}

  for (const pedaco of header.split(",")) {
    const separador = pedaco.indexOf("=")

    if (separador === -1) {
      continue
    }

    const chave = pedaco.slice(0, separador).trim().toLowerCase()
    const valor = pedaco.slice(separador + 1).trim()

    if (chave) {
      partes[chave] = valor
    }
  }

  if (!partes.ts || !partes.v1) {
    return null
  }

  return { ts: partes.ts, v1: partes.v1 }
}

/**
 * Os manifestos possíveis, em ordem de probabilidade.
 *
 * O `data.id` entra em **minúsculas** porque é assim que o Mercado Pago monta
 * o texto — `data.id` chega em maiúsculas no corpo de alguns tipos de evento, e
 * um `toLowerCase` faltando aqui faz a assinatura de **todo** webhook falhar
 * com o token certo na mão. É o erro mais caro deste arquivo, e por isso ele
 * está preso numa função com nome.
 */
export function manifestos(entrada: {
  dataId: unknown
  requestId?: unknown
  ts: string
}): string[] {
  const id = String(entrada.dataId ?? "").toLowerCase()
  const requisicao =
    typeof entrada.requestId === "string" ? entrada.requestId.trim() : ""
  const lista: string[] = []

  if (requisicao) {
    lista.push(`id:${id};request-id:${requisicao};ts:${entrada.ts};`)
  }

  lista.push(`id:${id};ts:${entrada.ts};`)

  return lista
}

/** O HMAC-SHA256 de um manifesto, em hexadecimal. */
export function assinar(manifesto: string, segredo: string): string {
  return createHmac("sha256", segredo).update(manifesto).digest("hex")
}

/**
 * Compara duas strings sem vazar o quanto elas batem.
 *
 * O comprimento é conferido **antes** porque `timingSafeEqual` **lança** com
 * buffers de tamanhos diferentes — e um `throw` ali seria um 500 num caminho
 * que precisa devolver 401.
 */
export function compararSeguro(a: string, b: string): boolean {
  const daqui = Buffer.from(a, "utf8")
  const dali = Buffer.from(b, "utf8")

  if (daqui.length !== dali.length) {
    return false
  }

  return timingSafeEqual(daqui, dali)
}

/** O que é preciso saber para julgar uma notificação. */
export type EntradaDaValidacao = {
  /** O header `x-signature` cru. */
  headerAssinatura: unknown
  /** O header `x-request-id` cru. */
  requestId?: unknown
  /** O `data.id` do corpo. */
  dataId: unknown
  /** Os segredos aceitáveis (ver `segredosDoWebhook`). */
  segredos: string[]
  /** A tolerância, em segundos. `0` desliga a checagem do relógio. */
  toleranciaSegundos?: number
  /** O "agora", injetável para o teste não depender do relógio da máquina. */
  agoraSegundos?: number
}

/**
 * A decisão: esta notificação foi assinada com um dos nossos segredos?
 *
 * A ordem das checagens vai do **mais barato e mais decisivo** para o mais
 * caro: formato, presença de segredo, presença de id, janela de tempo, e só
 * então o HMAC — a única que precisa calcular alguma coisa. Falhar cedo num
 * motivo diagnóstico é o que torna o log de um 401 útil.
 *
 * **A janela de tempo não é a garantia, é higiene.** `0` a desliga, e o design
 * continua de pé: a assinatura prova a origem, e a consulta a
 * `/v1/payments/{id}` — que o provider faz **depois**, já com o segredo
 * validado — é quem decide o efeito. Uma notificação antiga reentregue é
 * inofensiva porque o efeito é idempotente (ver `service.ts`).
 */
export function validarAssinatura(entrada: EntradaDaValidacao): Veredito {
  const assinatura = lerAssinatura(entrada.headerAssinatura)

  if (!assinatura) {
    return {
      ok: false,
      motivo: entrada.headerAssinatura ? "header_malformado" : "sem_header",
    }
  }

  if (!entrada.segredos?.length) {
    return { ok: false, motivo: "sem_segredo" }
  }

  const id = entrada.dataId

  if (id === undefined || id === null || String(id).trim() === "") {
    return { ok: false, motivo: "sem_id" }
  }

  const ts = Number(assinatura.ts)

  if (!Number.isFinite(ts)) {
    return { ok: false, motivo: "header_malformado" }
  }

  const tolerancia = entrada.toleranciaSegundos ?? 0

  if (tolerancia > 0) {
    const agora = entrada.agoraSegundos ?? Math.floor(Date.now() / 1000)

    if (Math.abs(agora - ts) > tolerancia) {
      return { ok: false, motivo: "fora_da_janela" }
    }
  }

  for (const manifesto of manifestos({
    dataId: id,
    requestId: entrada.requestId,
    ts: assinatura.ts,
  })) {
    for (const segredo of entrada.segredos) {
      if (compararSeguro(assinar(manifesto, segredo), assinatura.v1)) {
        return { ok: true, ts: assinatura.ts, manifesto }
      }
    }
  }

  return { ok: false, motivo: "assinatura_invalida" }
}
