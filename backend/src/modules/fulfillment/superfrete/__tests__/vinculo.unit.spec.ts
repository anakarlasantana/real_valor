import {
  DIAS_DE_JANELA,
  pedidoDaEtiqueta,
  TAMANHO_DA_PAGINA,
} from "../vinculo"

/** Um `listar` que devolve as páginas dadas, e conta quantas vezes foi chamado. */
type Linha = { id: string; metadata?: Record<string, unknown> }
type Pagina = { skip: number; take: number }

function paginador(paginas: Linha[][]) {
  const filtros: Array<{ created_at: { $gte: string } }> = []
  const paginasLidas: Pagina[] = []

  const listar = async (filtro: (typeof filtros)[number], config: Pagina) => {
    filtros.push(filtro)
    paginasLidas.push(config)
    return paginas[config.skip / TAMANHO_DA_PAGINA] ?? []
  }

  return { listar, filtros, paginasLidas }
}

const pedido = (id: string, etiqueta: string) => ({
  id,
  metadata: { superfrete_id: etiqueta },
})

/** Uma página cheia, para a varredura continuar. */
const cheia = (prefixo: string) =>
  Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => pedido(`${prefixo}${i}`, `x${i}`))

describe("pedidoDaEtiqueta", () => {
  it("acha o pedido pela etiqueta e devolve o id do Medusa", async () => {
    const { listar } = paginador([[pedido("order_1", "etq_1")]])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_1", listar })).toBe("order_1")
  })

  it("aceita espaço em volta, que é como o painel às vezes grava", async () => {
    const { listar } = paginador([[pedido("order_1", "etq_1")]])

    expect(await pedidoDaEtiqueta({ etiqueta: " etq_1 ", listar })).toBe("order_1")
  })

  // `listOrders` não filtra por metadata: sem a segunda página, um pedido que
  // não está entre os 200 mais novos nunca receberia o aviso.
  it("continua na página seguinte quando a primeira não tem o pedido", async () => {
    const { listar, paginasLidas } = paginador([cheia("a"), [pedido("order_9", "etq_9")]])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_9", listar })).toBe("order_9")
    expect(paginasLidas.map((p) => p.skip)).toEqual([0, TAMANHO_DA_PAGINA])
  })

  it("para na página incompleta, que é o fim da lista", async () => {
    const { listar, paginasLidas } = paginador([[pedido("order_1", "etq_1")]])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_nada", listar })).toBeNull()
    expect(paginasLidas).toHaveLength(1)
  })

  it("lê a página inteira mesmo achando o último item dela", async () => {
    const { listar, paginasLidas } = paginador([[...cheia("a"), pedido("order_9", "etq_9")]])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_9", listar })).toBe("order_9")
    expect(paginasLidas).toEqual([{ skip: 0, take: TAMANHO_DA_PAGINA }])
  })

  // Medido rodando o backend: `skip`/`take` no filtro derrubam o subscriber com
  // "Trying to query by not existing property Order.skip". São config.
  it("nunca põe a paginação no filtro", async () => {
    const { listar, filtros } = paginador([cheia("a"), [pedido("order_9", "etq_9")]])

    await pedidoDaEtiqueta({ etiqueta: "etq_9", listar })

    for (const filtro of filtros) {
      expect(Object.keys(filtro)).toEqual(["created_at"])
    }
  })

  // O aviso é anônimo na origem: procurar em todo o histórico é dar a qualquer
  // remetente uma varredura completa do banco.
  it("limita a varredura aos últimos dias", async () => {
    const { listar, filtros } = paginador([[pedido("order_1", "etq_1")]])
    const hoje = new Date("2026-10-18T12:00:00Z")

    await pedidoDaEtiqueta({ etiqueta: "etq_1", listar, hoje })

    expect(filtros[0].created_at.$gte).toBe(
      new Date(hoje.getTime() - DIAS_DE_JANELA * 86_400_000).toISOString()
    )
  })

  // Medido rodando o backend: `gte` sem cifrão derruba o subscriber com
  // "Trying to query by not existing property Order.gte". O operador é `$gte`.
  it("usa o operador `$gte`, e não `gte`", async () => {
    const { listar, filtros } = paginador([[pedido("order_1", "etq_1")]])

    await pedidoDaEtiqueta({ etiqueta: "etq_1", listar })

    expect(Object.keys(filtros[0].created_at)).toEqual(["$gte"])
  })

  it("ignora pedido sem etiqueta e pedido de outra etiqueta", async () => {
    const { listar } = paginador([
      [{ id: "order_sem" }, pedido("order_2", "etq_2"), pedido("order_1", "etq_1")],
    ])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_1", listar })).toBe("order_1")
  })

  it("devolve `null` quando a lista está vazia", async () => {
    const { listar } = paginador([[]])

    expect(await pedidoDaEtiqueta({ etiqueta: "etq_1", listar })).toBeNull()
  })
})
