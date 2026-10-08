/**
 * O aviso ao storefront: a URL, o segredo — e o silêncio quando falha.
 * -------------------------------------------------------------------------
 * Este arquivo existe porque o aviso passou a atender **duas** tags. Ele nasceu
 * com uma só (`content`, usada pelas quatro rotas de `/admin/content`) e agora
 * serve também o catálogo, por `subscribers/catalog-revalidate.ts`. O teste
 * prende as duas pontas disso:
 *
 *   - o caso antigo continua igual: `revalidateContent` publica `content`. Uma
 *     generalização que mudasse a tag que o CRM já usava derrubaria o aviso de
 *     conteúdo em silêncio — a loja só demoraria 60s para atualizar, que é
 *     exatamente o tipo de regressão que ninguém percebe;
 *   - o núcleo (`revalidateStorefrontTag`) monta a URL, manda o segredo e
 *     **nunca lança**.
 *
 * **Por que "nunca lança" é a asserção que importa.** Todo chamador dispara sem
 * `await` (`void revalidateContent(...)`, `notifyStorefrontTag`) e depois de a
 * gravação já ter acontecido. Uma exceção aqui não teria para onde subir: ou
 * viraria `unhandledRejection` no processo, ou (pior) derrubaria a resposta de
 * um `POST /admin/content` que já gravou — o CRM diria "erro" para uma edição
 * que está salva. Então HTTP de erro e rede fora do ar viram `warn`, e o teste
 * espera a promise **resolver** nos dois casos.
 *
 * O `fetch` é dublê: nada aqui toca a rede, e o storefront não é exercitado.
 */
import type { Logger } from "@medusajs/framework/types"

import { revalidateContent, revalidateStorefrontTag } from "../revalidate"

const ENDERECO = "http://frontend:8000"
const SEGREDO = "segredo-de-teste-do-aviso"

const fetchOriginal = global.fetch
const envOriginal = {
  FRONTEND_URL: process.env.FRONTEND_URL,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
}

/** Um logger de mentira, que guarda o que foi dito. */
function loggerFalso(passos: string[]): Logger {
  return {
    info: (m: string) => passos.push(`info:${m}`),
    warn: (m: string) => passos.push(`warn:${m}`),
    error: (m: string) => passos.push(`error:${m}`),
  } as unknown as Logger
}

/**
 * Dublê do `fetch`, na mesma forma do `webhook.unit.spec.ts`: guarda as
 * chamadas para que a asserção seja sobre o pedido que saiu — URL, método,
 * cabeçalho e o `signal` do timeout.
 */
function dublarFetch(resposta: { ok: boolean; status: number }) {
  const chamadas: Array<{ url: string; init?: RequestInit }> = []

  global.fetch = (async (url: string | URL, init?: RequestInit) => {
    chamadas.push({ url: String(url), init })

    return resposta as unknown as Response
  }) as unknown as typeof fetch

  return chamadas
}

beforeEach(() => {
  process.env.FRONTEND_URL = ENDERECO
  process.env.REVALIDATE_SECRET = SEGREDO
})

afterEach(() => {
  global.fetch = fetchOriginal

  for (const [chave, valor] of Object.entries(envOriginal)) {
    if (valor === undefined) {
      delete process.env[chave]
    } else {
      process.env[chave] = valor
    }
  }
})

describe("o pedido que sai", () => {
  it("publica a tag na rota do storefront, com o segredo no cabeçalho", async () => {
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await revalidateStorefrontTag(loggerFalso([]), "products")

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toBe(`${ENDERECO}/api/revalidate?tag=products`)
    expect(chamadas[0].init?.method).toBe("POST")
    expect(
      (chamadas[0].init?.headers as Record<string, string>)[
        "x-revalidate-secret"
      ]
    ).toBe(SEGREDO)
  })

  it("leva timeout — um storefront pendurado não segura quem avisa", async () => {
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await revalidateStorefrontTag(loggerFalso([]), "products")

    expect(chamadas[0].init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("não deixa a barra final do FRONTEND_URL virar barra dupla", async () => {
    process.env.FRONTEND_URL = `${ENDERECO}///`
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await revalidateStorefrontTag(loggerFalso([]), "products")

    expect(chamadas[0].url).toBe(`${ENDERECO}/api/revalidate?tag=products`)
  })

  it("escapa a tag antes de pôr na querystring", async () => {
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await revalidateStorefrontTag(loggerFalso([]), "prod utos")

    expect(chamadas[0].url).toContain("tag=prod%20utos")
  })

  it("⭐ o conteúdo continua sendo `content` — o CRM não mudou de tag", async () => {
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await revalidateContent(loggerFalso([]))

    expect(chamadas[0].url).toBe(`${ENDERECO}/api/revalidate?tag=content`)
  })
})

describe("quando o aviso é pulado", () => {
  it("sem FRONTEND_URL não há para onde avisar", async () => {
    delete process.env.FRONTEND_URL
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await expect(
      revalidateStorefrontTag(loggerFalso([]), "products")
    ).resolves.toBeUndefined()

    expect(chamadas).toHaveLength(0)
  })

  it("sem REVALIDATE_SECRET o storefront responderia 500 — nem tenta", async () => {
    // Fail-closed do outro lado: a rota do storefront recusa quando o segredo
    // dele não está definido. Um aviso que sai para receber 500 é ruído no log.
    delete process.env.REVALIDATE_SECRET
    const chamadas = dublarFetch({ ok: true, status: 200 })

    await expect(
      revalidateStorefrontTag(loggerFalso([]), "products")
    ).resolves.toBeUndefined()

    expect(chamadas).toHaveLength(0)
  })
})

describe("as falhas que não podem subir", () => {
  it("⭐ HTTP de erro vira warn — a gravação já aconteceu", async () => {
    const passos: string[] = []
    dublarFetch({ ok: false, status: 500 })

    await expect(
      revalidateStorefrontTag(loggerFalso(passos), "products")
    ).resolves.toBeUndefined()

    expect(passos.some((p) => p.startsWith("warn:"))).toBe(true)
    // A tag no aviso é o que diz QUAL cache ficou defasado.
    expect(passos.join(" ")).toContain("products")
    expect(passos.join(" ")).toContain("500")
  })

  it("⭐ rede fora do ar também vira warn", async () => {
    const passos: string[] = []
    global.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof fetch

    await expect(
      revalidateStorefrontTag(loggerFalso(passos), "products")
    ).resolves.toBeUndefined()

    expect(passos.join(" ")).toContain("ECONNREFUSED")
  })

  it("a promessa do aviso segue verdadeira: a loja se atualiza em até um minuto", async () => {
    // Era falso para o catálogo até a janela existir no storefront
    // (`frontend/src/lib/data/cookies.ts`): sem `revalidate`, a entrada não
    // expirava nunca. A frase abaixo é a que está no `warn`.
    const passos: string[] = []
    dublarFetch({ ok: false, status: 503 })

    await revalidateContent(loggerFalso(passos))

    expect(passos.join(" ")).toContain("até um minuto")
  })
})
