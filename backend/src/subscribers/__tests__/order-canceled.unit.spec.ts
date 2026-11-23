import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import orderCanceledHandler from "../order-canceled"

const PEDIDO = {
  id: "order_1",
  display_id: 42,
  email: "ana.silva@exemplo.com",
  currency_code: "brl",
  total: 189.9,
  payment_status: "captured",
  created_at: "2026-11-17T00:00:00Z",
  metadata: {},
  shipping_address: { first_name: "Ana" },
}

function montar(
  opcoes: {
    pedido?: Record<string, unknown>
    erroAoBuscar?: boolean
    criar?: (dados: Record<string, unknown>) => unknown
  } = {}
) {
  const avisos: string[] = []
  const infos: string[] = []
  const erros: string[] = []
  const criadas: Record<string, unknown>[] = []

  const container = {
    resolve: (chave: string) => {
      if (chave === ContainerRegistrationKeys.LOGGER) {
        return {
          warn: (mensagem: string) => avisos.push(mensagem),
          info: (mensagem: string) => infos.push(mensagem),
          error: (mensagem: string) => erros.push(mensagem),
        }
      }

      if (chave === Modules.ORDER) {
        return {
          retrieveOrder: async () => {
            if (opcoes.erroAoBuscar) {
              throw new Error("banco fora")
            }
            return opcoes.pedido ?? PEDIDO
          },
        }
      }

      if (chave === Modules.NOTIFICATION) {
        return {
          createNotifications: async (dados: Record<string, unknown>) => {
            criadas.push(dados)
            return opcoes.criar ? opcoes.criar(dados) : { id: "notif_1" }
          },
        }
      }

      return undefined
    },
  }

  return { container, avisos, infos, erros, criadas }
}

const chamar = (container: unknown) =>
  orderCanceledHandler({
    event: { data: { id: PEDIDO.id } },
    container,
  } as never)

describe("o e-mail de pedido cancelado", () => {
  it("usa a mesma chave de idempotência em duas execuções e envia uma vez", async () => {
    const primeira = montar()
    await chamar(primeira.container)

    const segunda = montar({ criar: () => undefined })
    await chamar(segunda.container)

    expect(primeira.criadas[0]).toMatchObject({
      template: "pedido-cancelado",
      idempotency_key: `order-canceled:${PEDIDO.id}`,
    })
    expect(segunda.criadas[0]).toMatchObject({
      idempotency_key: `order-canceled:${PEDIDO.id}`,
    })
    expect(primeira.infos).toHaveLength(1)
    expect(segunda.infos).toEqual([])
  })

  it("pedido sem e-mail não dispara nada e avisa", async () => {
    const { container, avisos, criadas } = montar({
      pedido: { ...PEDIDO, email: null },
    })

    await chamar(container)

    expect(criadas).toEqual([])
    expect(avisos[0]).toContain("sem e-mail")
  })

  it("falha ao ler o pedido não derruba o worker", async () => {
    const { container, erros } = montar({ erroAoBuscar: true })

    await expect(chamar(container)).resolves.toBeUndefined()

    expect(erros[0]).toContain("falha ao preparar o cancelamento")
  })

  it("o endereço do cliente nunca aparece cru no log", async () => {
    const { container, infos } = montar()

    await chamar(container)

    expect(infos[0]).toContain("a***@exemplo.com")
    expect(infos[0]).not.toContain(PEDIDO.email)
  })
})
