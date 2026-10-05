/**
 * A rota interna do storefront — "o pedido deste carrinho já existe?"
 * -------------------------------------------------------------------------
 * A pergunta da página de confirmação, feita de servidor a servidor. O que este
 * arquivo pina é a **resposta única** que a rota promete: cinco causas, um 404.
 *
 * **A asserção que protege dado pessoal é sobre a chave da resposta.** Não basta
 * o 200: a resposta é **três campos**, montados um a um. O dia em que alguém
 * devolver o pedido inteiro aqui, qualquer `cart_id` adivinhado lê endereço,
 * e-mail e total alheios — então o teste conta as chaves, e o `select` da
 * leitura também é observado (o cinto e o suspensório).
 *
 * **A asserção que protege o banco é sobre o que *não* aconteceu.** Um
 * `cart_id` de formato inválido que chegasse ao banco viraria uma consulta por
 * tentativa, e o primeiro a notar isso ganha uma amplificação barata. A regex
 * existe por isso, e o teste a observa pelo `graph` — que é dublê.
 *
 * **A que protege o pedido dos outros é o fail-closed.** Sem
 * `INTERNAL_API_SECRET` o backend **não tem como autenticar ninguém**, e aceitar
 * seria abrir a leitura de pedidos para a internet. É o irmão do "pior bug
 * possível" de `webhook.unit.spec.ts`.
 *
 * Nada aqui toca banco, rede ou o runtime do Medusa: `query` e `order` são
 * resolvidos pelo escopo da requisição, e ambos são dublês.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { GET, HEADER_INTERNO, POST } from "../route"

const SEGREDO = "segredo-interno-de-teste"
const CARTAO = "cart_01HQ8Z9K2M4N6P8R0T2V4X6Z8A"
const PEDIDO = "order_01HQ8Z9K2M4N6P8R0T2V4X6Z8B"

type Cenario = {
  /** `null` = não mandar o header. `undefined` = mandar o correto. */
  cabecalho?: string | null
  /** O `cart_id` da query string. */
  cartId?: string
  /** O que o link `order_cart` devolve. Um `Error` faz a consulta explodir. */
  link?: { order_id?: string }[] | Error
  /** O que `retrieveOrder` devolve. */
  pedido?: Record<string, unknown>
  /** Faz `retrieveOrder` explodir (o pedido sumiu após o link existir). */
  pedidoSumiu?: boolean
}

/** Monta o par (req, res) e as listas de efeitos observáveis. */
function cenario(config: Cenario = {}) {
  const avisos: string[] = []
  const consultas: Record<string, unknown>[] = []
  const selecoes: unknown[] = []

  const cabecalhos: Record<string, unknown> = {}

  if (config.cabecalho !== null) {
    cabecalhos[HEADER_INTERNO] = config.cabecalho ?? SEGREDO
  }

  const req = {
    headers: cabecalhos,
    query: { cart_id: config.cartId ?? CARTAO },
    scope: {
      resolve: (chave: string) => {
        if (chave === "logger") {
          return { warn: (m: string) => avisos.push(m) }
        }

        if (chave === ContainerRegistrationKeys.QUERY) {
          return {
            graph: async (consulta: Record<string, unknown>) => {
              consultas.push(consulta)

              if (config.link instanceof Error) {
                throw config.link
              }

              return { data: config.link ?? [] }
            },
          }
        }

        if (chave === "order") {
          return {
            retrieveOrder: async (id: string, opcoes: unknown) => {
              selecoes.push(opcoes)

              if (config.pedidoSumiu) {
                throw new Error("sumiu")
              }

              return config.pedido ?? { id, display_id: 42, status: "pending" }
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
    cabecalhosDeResposta: {} as Record<string, string>,
    status(codigo: number) {
      this.statusCode = codigo
      return this
    },
    json(payload: unknown) {
      this.corpo = payload
      return this
    },
    setHeader(nome: string, valor: string) {
      this.cabecalhosDeResposta[nome] = valor
      return this
    },
  }

  return { req, res, avisos, consultas, selecoes }
}

const segredoOriginal = process.env.INTERNAL_API_SECRET

beforeEach(() => {
  process.env.INTERNAL_API_SECRET = SEGREDO
})

afterEach(() => {
  if (segredoOriginal === undefined) {
    delete process.env.INTERNAL_API_SECRET
  } else {
    process.env.INTERNAL_API_SECRET = segredoOriginal
  }
})

describe("o segredo", () => {
  it("fail-closed: sem o segredo no backend, recusa e avisa", async () => {
    // ⭐ O pior bug possível desta rota: um backend sem `INTERNAL_API_SECRET`
    // respondendo a quem souber um `cart_id`.
    //
    // O cenário traz um pedido de verdade no link de propósito — se o guarda
    // cair, a resposta deixa de ser um 404 e passa a ser **200 com o pedido**.
    delete process.env.INTERNAL_API_SECRET

    const { req, res, avisos, consultas } = cenario({
      link: [{ order_id: PEDIDO }],
    })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
    expect(res.corpo).toEqual({ message: "Not Found" })
    expect(avisos.some((a) => a.includes("INTERNAL_API_SECRET"))).toBe(true)
    expect(consultas).toEqual([])
  })

  it("fail-closed: recusa quando não há header NENHUM — o caso de dois vazios", async () => {
    // ⭐ **Dois vazios:** sem o segredo no backend e **sem o header** na
    // requisição, os dois lados viram `""` — e o digest de `""` bate com o
    // digest de `""`. A comparação em tempo constante, que existe justamente
    // para não vazar o segredo, diria que confere.
    //
    // Este `it` é separado do de cima por um motivo **medido**: aqui dois
    // guardas independentes barram — o `if (!esperado)` e o `!recebido ||` da
    // própria condição da comparação. Um cobre o outro, e só derrubando os
    // **dois** o 200 aparece (verificado por mutação). Num laço único, a falha
    // da primeira volta esconderia esta.
    delete process.env.INTERNAL_API_SECRET

    const { req, res, consultas } = cenario({
      cabecalho: null,
      link: [{ order_id: PEDIDO }],
    })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
    expect(consultas).toEqual([])
  })

  it("responde 404 sem o header", async () => {
    const { req, res, consultas } = cenario({ cabecalho: null })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
    expect(consultas).toEqual([])
  })

  it("responde 404 com o header errado — o mesmo 404, sem distinguir", async () => {
    const { req, res } = cenario({ cabecalho: "segredo-de-quem-sonda" })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
    expect(res.corpo).toEqual({ message: "Not Found" })
  })

  it("confere o segredo com espaço em volta, dos dois lados", async () => {
    process.env.INTERNAL_API_SECRET = `  ${SEGREDO}  `

    const { req, res } = cenario({ link: [{ order_id: PEDIDO }] })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(200)
  })
})

describe("o formato do cart_id", () => {
  it("404 para um cart_id fora do formato — e SEM tocar o banco", async () => {
    // ⭐ Sem a regex, um `cart_id` de dois kilobytes custaria uma ida ao banco
    // por tentativa.
    const { req, res, consultas } = cenario({
      cartId: `cart_${"X".repeat(2000)}`,
    })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
    expect(consultas).toEqual([])
  })

  it("404 para as letras que o Crockford base32 não tem", async () => {
    // `I`, `L`, `O` e `U` não existem num ULID — e são justamente as que
    // alguém digitaria por confusão com `1`, `0` e `V`.
    const { req, res } = cenario({ cartId: "cart_01HQ8Z9K2M4N6P8R0T2V4X6Z8I" })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })

  it("404 para um cart_id ausente", async () => {
    const { req, res } = cenario({ cartId: "" })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })
})

describe("o link com o pedido", () => {
  it("404 quando o carrinho ainda não tem pedido (o caso mais comum)", async () => {
    // A cliente pagou e o webhook ainda não processou. O storefront chama de
    // novo em alguns segundos — e recebe o mesmo 404 de todas as outras causas.
    const { req, res } = cenario({ link: [] })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })

  it("404 quando a consulta do link explode (cart_id válido e inexistente)", async () => {
    const { req, res } = cenario({ link: new Error("não existe") })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })

  it("404 quando o pedido some entre o link e a leitura", async () => {
    const { req, res } = cenario({
      link: [{ order_id: PEDIDO }],
      pedidoSumiu: true,
    })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })
})

describe("a resposta", () => {
  it("devolve TRÊS campos, e só — nunca o pedido inteiro", async () => {
    // ⭐ O assert que protege dado pessoal, e o que a docstring da rota promete.
    const { req, res, selecoes } = cenario({
      link: [{ order_id: PEDIDO }],
      pedido: {
        id: PEDIDO,
        display_id: 42,
        status: "pending",
        // O que NÃO pode vazar por aqui:
        email: "alguem@exemplo.com",
        shipping_address: { city: "São Paulo" },
        total: 18990,
      },
    })

    await GET(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.corpo as object).sort()).toEqual([
      "display_id",
      "id",
      "status",
    ])
    expect(res.corpo).toEqual({
      id: PEDIDO,
      display_id: 42,
      status: "pending",
    })
    expect(selecoes).toEqual([{ select: ["id", "display_id", "status"] }])
  })

  it("a resposta não é cacheável", async () => {
    // Ela muda no instante em que o webhook processa. Em cache, a página de
    // confirmação esperaria por um pedido que já existe.
    const { req, res } = cenario({ link: [{ order_id: PEDIDO }] })

    await GET(req as never, res as never)

    expect(res.cabecalhosDeResposta["Cache-Control"]).toBe("no-store, max-age=0")
  })
})

describe("o que a rota não faz", () => {
  it("POST responde 404 — um GET é a única coisa que ela faz", async () => {
    const { req, res } = cenario()

    await POST(req as never, res as never)

    expect(res.statusCode).toBe(404)
  })

  it("o 404 não diz qual das cinco causas foi", async () => {
    // Cinco causas, uma resposta — porque distinguir diria a quem sonda
    // **qual** delas tentar de novo.
    const respostas = await Promise.all(
      [
        cenario({ cabecalho: null }),
        cenario({ cabecalho: "errado" }),
        cenario({ cartId: "nope" }),
        cenario({ link: [] }),
        cenario({ link: new Error("x") }),
      ].map(async ({ req, res }) => {
        await GET(req as never, res as never)

        return JSON.stringify({ status: res.statusCode, corpo: res.corpo })
      })
    )

    expect(new Set(respostas).size).toBe(1)
  })
})
