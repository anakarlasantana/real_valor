/**
 * O handler do webhook — a porta por onde um pedido pago pode nascer.
 * -------------------------------------------------------------------------
 * Cada `it` daqui é uma tentativa de fazer um pedido existir sem pagamento, ou
 * um pagamento existir sem pedido. A pergunta que o arquivo responde é sempre a
 * mesma: **o que aconteceu quando chegou este POST?**
 *
 * **Por que a asserção mais importante é sobre o `fetch`.** A primeira coisa que
 * um webhook inválido não pode fazer é provocar efeitos: nem consultar o
 * provedor, nem ler o banco, nem emitir evento. Um handler que responde 401
 * **depois** de consultar a API do Mercado Pago está gastando uma chamada por
 * tentativa de quem sonda — e um handler que responde 401 **depois** de gravar
 * algo já perdeu. Então o teste não olha só o status: olha que nada aconteceu.
 *
 * O `fetch` é dublê, então nada aqui toca a rede. O provedor não é
 * exercitado neste arquivo — ele é a segunda camada, e tem teste próprio.
 */
import { createHmac } from "node:crypto"

import { Modules } from "@medusajs/framework/utils"

import { receberNotificacao } from "../webhook"

const SEGREDO = "segredo-de-teste-do-webhook"
const TS = 1_700_000_000
const PAGAMENTO = "987654321"
const SESSAO = "payses_01HQ8Z9K2M4N6P8R0T2V4X6Z8A"

/** Assina como o provedor: HMAC-SHA256 do manifesto. */
function assinatura(requestId = "req-1", id = PAGAMENTO, ts = TS): string {
  const manifesto = `id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`
  const v1 = createHmac("sha256", SEGREDO).update(manifesto).digest("hex")

  return `ts=${ts},v1=${v1}`
}

/** Um logger de mentira, que guarda o que foi dito. */
function loggerFalso(passos: string[]) {
  return {
    info: (m: string) => passos.push(`info:${m}`),
    warn: (m: string) => passos.push(`warn:${m}`),
    error: (m: string) => passos.push(`error:${m}`),
  }
}

type Cenario = {
  /** O que o provedor responde em `/v1/payments/{id}`. */
  pagamento?: Record<string, unknown>
  /** O que o banco responde ao buscar a sessão. `undefined` = não existe. */
  sessao?: Record<string, unknown>
  /** Faz a consulta ao provedor explodir (rede fora). */
  provedorFora?: boolean
  /** Faz a gravação do selo explodir. */
  falhaAoSelar?: boolean
  /** Headers extras/em falta. */
  cabecalhos?: Record<string, unknown>
  /** O corpo cru da notificação. */
  corpo?: Record<string, unknown>
}

/** Monta o par (req, res) e as listas de efeitos colaterais observáveis. */
function cenario(config: Cenario = {}) {
  const passos: string[] = []
  const emitidos: Record<string, unknown>[] = []
  const selagens: Record<string, unknown>[] = []
  const chamadasAoProvedor: string[] = []

  const corpo = config.corpo ?? {
    type: "payment",
    action: "payment.updated",
    data: { id: PAGAMENTO },
  }

  const pagamento = config.pagamento ?? {
    id: PAGAMENTO,
    status: "approved",
    transaction_amount: 189.9,
    external_reference: SESSAO,
  }

  // O dublê do `fetch`. Toda chamada é registrada: **é o que a asserção de
  // "nada aconteceu" observa.**
  const fetchFalso = jest.fn(async (url: string | URL) => {
    chamadasAoProvedor.push(String(url))

    if (config.provedorFora) {
      throw new TypeError("fetch failed")
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(pagamento),
    } as unknown as Response
  })

  const req = {
    body: corpo,
    rawBody: JSON.stringify(corpo),
    headers: {
      "x-signature": assinatura(),
      "x-request-id": "req-1",
      ...(config.cabecalhos ?? {}),
    },
    scope: {
      resolve: (chave: string) => {
        if (chave === "logger") return loggerFalso(passos)

        if (chave === Modules.PAYMENT) {
          return {
            options: {},
            retrievePaymentSession: async () => {
              if (!config.sessao) {
                throw new Error("not found")
              }
              return config.sessao
            },
            updatePaymentSession: async (entrada: Record<string, unknown>) => {
              if (config.falhaAoSelar) {
                throw new Error("banco fora")
              }
              selagens.push(entrada)
              return entrada
            },
          }
        }

        if (chave === Modules.EVENT_BUS) {
          return {
            emit: async (evento: Record<string, unknown>) => {
              emitidos.push(evento)
            },
          }
        }

        return undefined
      },
    },
  }

  const res = {
    statusCode: 0,
    corpo: undefined as unknown,
    status(codigo: number) {
      this.statusCode = codigo
      return this
    },
    json(payload: unknown) {
      this.corpo = payload
      return this
    },
  }

  global.fetch = fetchFalso as unknown as typeof fetch

  return { req, res, emitidos, selagens, chamadasAoProvedor, passos, fetchFalso }
}

/** A sessão do Pix, que é o caso comum. */
const SESSAO_DO_PIX = {
  id: SESSAO,
  provider_id: "pp_mercadopago_pix",
  amount: 18990,
  currency_code: "brl",
  data: { session_id: SESSAO, init_point: "https://mp/checkout" },
}

const fetchOriginal = global.fetch

beforeEach(() => {
  process.env.MP_WEBHOOK_SECRET = SEGREDO
  delete process.env.MP_WEBHOOK_SECRET_TEST
  process.env.MP_WEBHOOK_TOLERANCIA_SEGUNDOS = "0"
  // O cliente exige token para falar com o provedor. O valor é irrelevante: o
  // `fetch` é dublê — o que importa é que o caminho não pare em "não
  // configurado", que é um 503 antes de qualquer verificação.
  process.env.MP_ACCESS_TOKEN = "TEST-nao-e-um-token-de-verdade"
})

afterEach(() => {
  global.fetch = fetchOriginal
  jest.restoreAllMocks()
})

describe("a assinatura recusada", () => {
  it("responde 401 sem o header — e NADA acontece antes disso", async () => {
    // ⭐ A asserção que importa. Não basta o 401: um handler que consulta o
    // provedor **antes** de validar gastaria uma chamada por tentativa de quem
    // sonda, e um handler que grava antes de validar já teria perdido.
    const { req, res, emitidos, selagens, chamadasAoProvedor } = cenario({
      cabecalhos: { "x-signature": undefined },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(chamadasAoProvedor).toEqual([])
    expect(selagens).toEqual([])
    expect(emitidos).toEqual([])
  })

  it("responde 401 para um header quebrado", async () => {
    const { req, res, chamadasAoProvedor } = cenario({
      cabecalhos: { "x-signature": "lixo" },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(chamadasAoProvedor).toEqual([])
  })

  it("responde 401 para uma assinatura feita com OUTRO segredo", async () => {
    // O ataque direto: um HMAC calculado com um segredo qualquer.
    const v1 = createHmac("sha256", "segredo-do-atacante")
      .update(`id:${PAGAMENTO};request-id:req-1;ts:${TS};`)
      .digest("hex")

    const { req, res, chamadasAoProvedor } = cenario({
      cabecalhos: { "x-signature": `ts=${TS},v1=${v1}` },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(chamadasAoProvedor).toEqual([])
  })

  it("responde 401 quando não há segredo configurado, em vez de aceitar", async () => {
    // ⚠️ O pior bug possível deste arquivo. Sem esta recusa, uma instalação sem
    // `MP_WEBHOOK_SECRET` aceitaria **qualquer** POST como pagamento aprovado.
    delete process.env.MP_WEBHOOK_SECRET

    const { req, res, emitidos, chamadasAoProvedor } = cenario({
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(chamadasAoProvedor).toEqual([])
    expect(emitidos).toEqual([])
  })

  it("responde 401 quando o corpo traz outro id, com assinatura de um só", async () => {
    // Assinatura legítima do pagamento 987654321, corpo apontando para outro.
    const { req, res, chamadasAoProvedor } = cenario({
      corpo: { type: "payment", data: { id: "111111111" } },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(chamadasAoProvedor).toEqual([])
  })

  it("responde 401 quando o corpo não traz `data.id`", async () => {
    // ⭐ A assinatura nem chega a ser conferida: `validarAssinatura` devolve
    // `sem_id` antes do HMAC, e é o `motivo` do log que nomeia a causa.
    //
    // Este caso já prometeu, num comentário, um 200 "ignorada" que o código não
    // entregava — inalcançável, porque o portão recusa antes. E o 200 seria
    // pior: responderia sucesso a um POST que não provou nada.
    const { req, res, passos, chamadasAoProvedor } = cenario({
      corpo: { type: "test", action: "test.created" },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(passos.some((p) => p.includes("sem_id"))).toBe(true)
    expect(chamadasAoProvedor).toEqual([])
  })
})

describe("o caminho que cria o pedido", () => {
  it("aprova, sela a sessão e emite para o provider do Pix", async () => {
    const { req, res, emitidos, selagens, chamadasAoProvedor } = cenario({
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(chamadasAoProvedor).toHaveLength(1)

    // O selo que `authorizePayment` exige — e ele preserva o `data` antigo.
    expect(selagens).toHaveLength(1)
    expect(selagens[0]).toMatchObject({ id: SESSAO, amount: 18990 })
    expect(
      (selagens[0].data as Record<string, unknown>).init_point
    ).toBe("https://mp/checkout")
    expect(
      (selagens[0].data as Record<string, unknown>).mp_confirmacao
    ).toMatchObject({ payment_id: PAGAMENTO, status: "approved", amount: 18990 })

    // O evento, com o contexto verificado e **sem** o prefixo `pp_`.
    expect(emitidos).toHaveLength(1)
    expect(emitidos[0]).toMatchObject({
      name: "payment.webhook_received",
      data: { provider: "mercadopago_pix" },
    })

    const payload = (emitidos[0].data as { payload: Record<string, unknown> }).payload
    expect(payload.rv).toMatchObject({
      session_id: SESSAO,
      provider_id: "pp_mercadopago_pix",
      metodo: "pix",
      amount: 18990,
    })
    // O corpo cru fica **intacto** ao lado do contexto — é o que permite tratar
    // `payload.data` como "o que o provedor mandou".
    expect(payload.data).toMatchObject({ type: "payment", data: { id: PAGAMENTO } })
  })

  it("vale a SESSÃO quando a URL diz outro meio", async () => {
    // A URL é controlada por quem envia. O evento tem de ir para o provider da
    // sessão — o do cartão — e não para o da URL.
    const { req, res, emitidos } = cenario({
      sessao: { ...SESSAO_DO_PIX, provider_id: "pp_mercadopago_cartao" },
    })

    await receberNotificacao(req as never, res as never, "pix")

    expect(res.statusCode).toBe(200)
    expect(emitidos[0]).toMatchObject({ data: { provider: "mercadopago_cartao" } })
  })
})

describe("o que NÃO pode criar pedido", () => {
  it("valor divergente: nada é aplicado e o log pede conferência", async () => {
    // ⚠️ Um pedido de R$ 1.899,00 pago com R$ 1,00. A sessão manda; o provedor
    // confirmou, mas os valores não batem. Aplicar cegaria o financeiro.
    const { req, res, emitidos, selagens, passos } = cenario({
      pagamento: {
        id: PAGAMENTO,
        status: "approved",
        transaction_amount: 1.0,
        external_reference: SESSAO,
      },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(selagens).toEqual([])
    expect(emitidos).toEqual([])
    expect(passos.some((p) => p.includes("VALOR DIVERGENTE"))).toBe(true)
  })

  it("status `pending` (o QR do Pix recém-gerado) não faz nada", async () => {
    // A maioria das notificações do Pix é esta. Se ela criasse pedido, cada QR
    // gerado e abandonado reservaria estoque.
    const { req, res, emitidos, selagens, passos } = cenario({
      pagamento: {
        id: PAGAMENTO,
        status: "pending",
        transaction_amount: 189.9,
        external_reference: SESSAO,
      },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(selagens).toEqual([])
    expect(emitidos).toEqual([])
    expect(passos.some((p) => p.includes('está "pending"'))).toBe(true)
  })

  it("pagamento de outra integração (sem external_reference) é ignorado", async () => {
    const { req, res, emitidos } = cenario({
      pagamento: { id: PAGAMENTO, status: "approved", transaction_amount: 10 },
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(emitidos).toEqual([])
  })

  it("sessão que não existe é ignorada, sem erro", async () => {
    const { req, res, emitidos, selagens } = cenario({ sessao: undefined })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(selagens).toEqual([])
    expect(emitidos).toEqual([])
  })

  it("sessão de um provider que não é nosso é ignorada", async () => {
    // É o caso do `pp_system_default` do Medusa: um meio que existe, que não é
    // do Mercado Pago, e que não tem o que fazer com esta notificação.
    const { req, res, emitidos, passos } = cenario({
      sessao: { ...SESSAO_DO_PIX, provider_id: "pp_system_default" },
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(emitidos).toEqual([])
    expect(passos.some((p) => p.includes("não é do Mercado Pago"))).toBe(true)
  })
})

describe("as falhas que precisam de reentrega", () => {
  it("provedor fora responde 500, para o Mercado Pago reentregar", async () => {
    // ⚠️ Devolver 200 aqui diria "recebi, pode esquecer" para um pagamento que
    // ainda não foi aplicado — e o pedido nunca existiria, com o dinheiro
    // recebido. O 500 é o pedido de reentrega.
    const { req, res, emitidos } = cenario({
      provedorFora: true,
      sessao: SESSAO_DO_PIX,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(500)
    expect(emitidos).toEqual([])
  })

  it("falha ao gravar o selo responde 500, e não emite", async () => {
    // Sem o selo, `authorizePayment` recusa e o pedido não nasce. Emitir mesmo
    // assim gastaria o evento para não criar nada; o 500 faz o provedor
    // reentregar, e na reentrega o selo pode ser gravado.
    const { req, res, emitidos } = cenario({
      sessao: SESSAO_DO_PIX,
      falhaAoSelar: true,
    })

    await receberNotificacao(req as never, res as never)

    expect(res.statusCode).toBe(500)
    expect(emitidos).toEqual([])
  })
})
