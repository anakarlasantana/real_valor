/**
 * O aviso à loja quando o catálogo muda — o que faltava para "salvei e apareceu".
 * -------------------------------------------------------------------------
 * O bug medido: uma peça publicada no painel aparecia em `/br/store` e **não**
 * aparecia nas seções da home, porque a entrada de cache da home tinha sido
 * gravada antes da publicação e nada a limpava. O subscriber é a correção da
 * ponta do backend, e a pergunta que este arquivo responde é: **este evento
 * limpa a tag certa, e a tempo?**
 *
 * Três coisas precisam valer juntas, e cada uma tem teste:
 *
 *   1. o evento está **assinado** (`config.event`). Um handler correto que nunca
 *      é chamado não serve para nada — e é o erro que não aparece em lugar
 *      nenhum: nada falha, a loja só volta a ficar velha;
 *   2. a tag do evento é a certa: `product.updated` → `products`;
 *      `product-category.updated` → `categories` **e** `products`, porque o nome
 *      da categoria entra na listagem de produtos;
 *   3. o handler **não espera** o `POST`. Ele roda dentro do caminho de gravação
 *      do painel: um storefront pendurado não pode segurar o `await` de quem
 *      salvou um produto. O caso com ⭐ prende isso com um `fetch` que **nunca
 *      resolve** — se alguém puser `await`, o teste estoura o timeout do jest em
 *      vez de passar.
 *
 * O `fetch` é dublê (nada aqui toca a rede) e o container é de mentira, com
 * `resolve` devolvendo um logger que guarda o que foi dito.
 */
import type { MedusaContainer } from "@medusajs/framework/types"

import catalogRevalidateHandler, {
  config,
  TAGS_BY_EVENT,
  tagsForEvent,
} from "../catalog-revalidate"

const ENDERECO = "http://frontend:8000"
const SEGREDO = "segredo-de-teste-do-aviso"

/**
 * Os doze eventos, escritos por extenso de propósito.
 *
 * O mapa é montado a partir dos enums do Medusa, então um erro de digitação é
 * impossível — mas um upgrade que **renomeie** um evento é silencioso: o
 * subscriber deixa de ser chamado e a loja para de acompanhar o painel sem
 * nenhum erro no log. Estes literais são o alarme.
 */
const EVENTOS_ESPERADOS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "product-variant.created",
  "product-variant.updated",
  "product-variant.deleted",
  "product-category.created",
  "product-category.updated",
  "product-category.deleted",
  "product-collection.created",
  "product-collection.updated",
  "product-collection.deleted",
]

const fetchOriginal = global.fetch
const envOriginal = {
  FRONTEND_URL: process.env.FRONTEND_URL,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
}

function loggerFalso(passos: string[]) {
  return {
    info: (m: string) => passos.push(`info:${m}`),
    warn: (m: string) => passos.push(`warn:${m}`),
    error: (m: string) => passos.push(`error:${m}`),
  }
}

/** Um container com um logger só — é tudo de que o aviso precisa. */
function containerFalso(passos: string[] = []) {
  return {
    resolve: () => loggerFalso(passos),
  } as unknown as MedusaContainer
}

/** Dublê do `fetch`: guarda as URLs chamadas. */
function dublarFetch(resposta: unknown = { ok: true, status: 200 }) {
  const chamadas: string[] = []

  global.fetch = (async (url: string | URL) => {
    chamadas.push(String(url))

    return resposta as Response
  }) as unknown as typeof fetch

  return chamadas
}

/** A tag que saiu de cada chamada — `…?tag=products` → `products`. */
function tagsChamadas(chamadas: string[]): string[] {
  return chamadas.map((url) => url.split("tag=")[1] ?? "")
}

/** Dispara o handler como o event bus dispara. */
async function disparar(nome: string, passos: string[] = []) {
  await catalogRevalidateHandler({
    event: { name: nome, data: { id: "id_1" } },
    container: containerFalso(passos),
    pluginOptions: {},
  })
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

describe("o que cada evento limpa", () => {
  it("⭐ publicar ou editar peça limpa `products` — é o cache das seções da home", async () => {
    const chamadas = dublarFetch()

    await disparar("product.created")

    expect(tagsChamadas(chamadas)).toEqual(["products"])
  })

  it("editar variante também limpa `products` — preço, estoque e cor vivem nela", async () => {
    const chamadas = dublarFetch()

    await disparar("product-variant.updated")

    expect(tagsChamadas(chamadas)).toEqual(["products"])
  })

  it("mexer na categoria limpa `categories` e `products`", async () => {
    // O nome e a ordem da categoria entram na listagem de produtos: limpar só
    // `categories` deixaria a vitrine com o filtro antigo.
    const chamadas = dublarFetch()

    await disparar("product-category.updated")

    expect(tagsChamadas(chamadas)).toEqual(["categories", "products"])
  })

  it("mexer na coleção limpa `collections` e `products`", async () => {
    const chamadas = dublarFetch()

    await disparar("product-collection.deleted")

    expect(tagsChamadas(chamadas)).toEqual(["collections", "products"])
  })

  it("evento fora do catálogo não avisa nada", async () => {
    const chamadas = dublarFetch()

    await disparar("order.placed")

    expect(chamadas).toHaveLength(0)
    expect(tagsForEvent("order.placed")).toEqual([])
  })
})

describe("a assinatura", () => {
  it("⭐ os doze eventos estão assinados — a lista sai do próprio mapa", () => {
    const assinados = Array.isArray(config.event)
      ? config.event
      : [config.event]

    expect([...assinados].sort()).toEqual([...EVENTOS_ESPERADOS].sort())
    expect(Object.keys(TAGS_BY_EVENT).sort()).toEqual(
      [...EVENTOS_ESPERADOS].sort()
    )
  })
})

describe("o que não pode atrasar o painel", () => {
  it("⭐ um storefront pendurado não segura o handler (o aviso é `void`)", async () => {
    // Uma promise que nunca resolve: se o handler esperasse o POST, este `await`
    // ficaria preso até o timeout do jest. É a diferença entre "salvei o produto"
    // responder agora e responder quando o cache aceitar.
    global.fetch = (() => new Promise(() => {})) as unknown as typeof fetch

    await expect(disparar("product.updated")).resolves.toBeUndefined()
  })

  it("o warn sai pelo logger do container que disparou o evento", async () => {
    const passos: string[] = []
    dublarFetch({ ok: false, status: 500 })

    await disparar("product.updated", passos)
    // O aviso é disparado sem `await`, então a falha é registrada um tick
    // depois; esperar o próximo turno do event loop é o suficiente.
    await new Promise((resolve) => setImmediate(resolve))

    expect(passos.join(" ")).toContain("products")
  })
})

