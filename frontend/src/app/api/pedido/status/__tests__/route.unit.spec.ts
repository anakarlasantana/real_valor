import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let cartaoDoCookie: string | undefined
let corpoDoBackend: unknown
let statusDoBackend: number
let backendFora: boolean
const chamadas: string[] = []

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => ({ value: cartaoDoCookie }) }),
}))

vi.mock("next/server", () => ({
  NextResponse: {
    json: (
      corpo: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) => ({
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => corpo,
    }),
  },
}))

import { GET, POST } from "../route"

const CARTAO = "cart_01M5G9QFTBYF1EGTWR71NSYKED"

const ler = async (resposta: { json: () => Promise<unknown> }) =>
  (await resposta.json()) as Record<string, unknown>

beforeEach(() => {
  cartaoDoCookie = CARTAO
  corpoDoBackend = {}
  statusDoBackend = 200
  backendFora = false
  chamadas.length = 0
  process.env.INTERNAL_API_SECRET = "segredo-de-teste"
  process.env.MEDUSA_BACKEND_URL = "http://backend:9000/"

  global.fetch = (async (url: string) => {
    chamadas.push(String(url))
    if (backendFora) {
      throw new TypeError("fetch failed")
    }
    return {
      ok: statusDoBackend >= 200 && statusDoBackend < 300,
      status: statusDoBackend,
      json: async () => corpoDoBackend,
    } as unknown as Response
  }) as unknown as typeof fetch
})

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.INTERNAL_API_SECRET
})

describe("GET /api/pedido/status", () => {
  it("sem segredo configurado responde 503 e não chama o backend", async () => {
    delete process.env.INTERNAL_API_SECRET

    const resposta = await GET()

    expect(resposta.status).toBe(503)
    expect(await ler(resposta)).toMatchObject({ erro: "configuracao" })
    expect(chamadas).toEqual([])
  })

  it("sem cookie de carrinho válido responde 404 e não chama o backend", async () => {
    cartaoDoCookie = "cart_invalido"

    const resposta = await GET()

    expect(resposta.status).toBe(404)
    expect(await ler(resposta)).toMatchObject({ encontrado: false })
    expect(chamadas).toEqual([])
  })

  it("backend fora do ar responde 502, e não 404", async () => {
    backendFora = true

    const resposta = await GET()

    expect(resposta.status).toBe(502)
    expect(await ler(resposta)).toMatchObject({ erro: "backend" })
  })

  it("carrinho ainda sem pedido responde 404", async () => {
    statusDoBackend = 404

    const resposta = await GET()

    expect(resposta.status).toBe(404)
    expect(await ler(resposta)).toMatchObject({ encontrado: false })
  })

  it("404 com recusa leva o estado do pagamento", async () => {
    statusDoBackend = 404
    corpoDoBackend = { pagamento: "recusado" }

    const resposta = await GET()

    expect(resposta.status).toBe(404)
    expect(await ler(resposta)).toMatchObject({
      encontrado: false,
      pagamento: "recusado",
    })
  })

  it("404 sem estado devolve pagamento nulo", async () => {
    statusDoBackend = 404
    corpoDoBackend = {}

    const resposta = await GET()

    expect(resposta.status).toBe(404)
    expect(await ler(resposta)).toMatchObject({ encontrado: false, pagamento: null })
  })

  it("assina a chamada interna com o segredo e sem cache", async () => {
    statusDoBackend = 200
    corpoDoBackend = { id: "order_1", display_id: 42, status: "pending" }

    await GET()

    expect(chamadas[0]).toBe(
      "http://backend:9000/internal/orders/by-cart?cart_id=" + CARTAO
    )
  })

  it("expõe só três campos, mesmo quando o backend devolve o pedido inteiro", async () => {
    corpoDoBackend = {
      id: "order_1",
      display_id: 42,
      status: "pending",
      email: "ana.silva@exemplo.com",
      total: 189.9,
      items: [{ title: "Vestido" }],
      metadata: { cpf: "12345678900" },
    }

    const resposta = await GET()
    const corpo = await ler(resposta)

    expect(resposta.status).toBe(200)
    expect(Object.keys(corpo).sort()).toEqual([
      "display_id",
      "encontrado",
      "id",
      "status",
    ])
    expect(JSON.stringify(corpo)).not.toContain("ana.silva@exemplo.com")
    expect(JSON.stringify(corpo)).not.toContain("12345678900")
  })
})

describe("POST /api/pedido/status", () => {
  it("recusa com 405 e aponta o método permitido", async () => {
    const resposta = await POST()

    expect(resposta.status).toBe(405)
    expect(resposta.headers.get("Allow")).toBe("GET")
  })
})
