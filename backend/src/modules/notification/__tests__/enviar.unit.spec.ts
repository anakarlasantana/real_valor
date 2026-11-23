import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { enviarEmail, mascararEmail } from "../enviar"

function montar(opcoes: { criar?: (dados: Record<string, unknown>) => unknown } = {}) {
  const avisos: string[] = []
  const criadas: Record<string, unknown>[] = []

  const container = {
    resolve: (chave: string) => {
      if (chave === ContainerRegistrationKeys.LOGGER) {
        return {
          warn: (mensagem: string) => avisos.push(mensagem),
          info: () => undefined,
          error: () => undefined,
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

  return { container, avisos, criadas }
}

describe("mascararEmail", () => {
  it("mostra a primeira letra e preserva o domínio", () => {
    expect(mascararEmail("ana.silva@exemplo.com")).toBe("a***@exemplo.com")
  })

  it("não inventa endereço quando não há e-mail", () => {
    expect(mascararEmail(null)).toBe("(sem e-mail)")
    expect(mascararEmail("   ")).toBe("(sem e-mail)")
  })

  it("não vaza texto sem domínio", () => {
    expect(mascararEmail("sem-arroba")).toBe("***")
  })
})

describe("enviarEmail", () => {
  it("sem destinatário, avisa e não chama o módulo", async () => {
    const { container, avisos, criadas } = montar()

    const enviado = await enviarEmail(container as never, {
      to: "",
      template: "pedido-confirmado",
      data: {},
    })

    expect(enviado).toBe(false)
    expect(criadas).toEqual([])
    expect(avisos[0]).toContain("não saiu: o pedido não tem e-mail")
  })

  it("envia com canal, template e chave de idempotência", async () => {
    const { container, criadas } = montar()

    const enviado = await enviarEmail(container as never, {
      to: "ana.silva@exemplo.com",
      template: "pedido-cancelado",
      data: { NOME: "Ana" },
      idempotencyKey: "order-canceled:order_1",
      triggerType: "order.canceled",
      resourceId: "order_1",
    })

    expect(enviado).toBe(true)
    expect(criadas).toHaveLength(1)
    expect(criadas[0]).toMatchObject({
      to: "ana.silva@exemplo.com",
      channel: "email",
      template: "pedido-cancelado",
      idempotency_key: "order-canceled:order_1",
      trigger_type: "order.canceled",
      resource_id: "order_1",
      resource_type: "order",
    })
  })

  it("chave já usada não reenvia: o módulo devolve vazio", async () => {
    const { container, criadas } = montar({ criar: () => undefined })

    const enviado = await enviarEmail(container as never, {
      to: "ana.silva@exemplo.com",
      template: "pedido-cancelado",
      data: {},
      idempotencyKey: "order-canceled:order_1",
    })

    expect(enviado).toBe(false)
    expect(criadas).toHaveLength(1)
  })

  it("falha do módulo não lança, devolve false e mascara o endereço", async () => {
    const { container, avisos } = montar({
      criar: () => {
        throw new Error("provedor fora")
      },
    })

    await expect(
      enviarEmail(container as never, {
        to: "ana.silva@exemplo.com",
        template: "pedido-enviado",
        data: {},
      })
    ).resolves.toBe(false)

    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain("a***@exemplo.com")
    expect(avisos[0]).not.toContain("ana.silva@exemplo.com")
  })
})
