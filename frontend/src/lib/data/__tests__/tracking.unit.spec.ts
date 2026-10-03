/**
 * A tradução da resposta de rastreio em situação de tela.
 * -------------------------------------------------------------------------
 * O que este teste protege são as **quatro saídas possíveis** e uma garantia
 * de configuração que é a mais importante de todas: a consulta nunca pode ser
 * cacheada.
 *
 * A razão é o dado que trafega. Todas as outras respostas do storefront são
 * públicas e idênticas para todo mundo; esta tem o CPF da cliente dentro. Com
 * qualquer cache — do Next, do CDN na frente, ou do fetch do Node — uma
 * consulta poderia ser servida para outra pessoa, e o erro aqui é mostrar o
 * pedido de uma cliente para outra. Por isso o teste confere o `cache:
 * "no-store"` e não confia em uma constante compartilhada com o resto.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * O `vi.mock` é hoisted para o topo do arquivo, então a função precisa ser
 * criada DENTRO da factory — referenciar uma `const` de fora dá
 * "Cannot access before initialization". O `vi.hoisted` sobe a declaração
 * junto com o mock, que é o que permite inspecionar as chamadas depois.
 */
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: fetchMock } },
}))

import { consultarRastreio } from "@lib/data/tracking"

/** Um 200 com rastreio — o caminho feliz. */
const RESPOSTA_COM_RASTREIO = {
  order: {
    id: "ped_1",
    display_id: 123,
    email: "cliente@email.com",
    status: "completed",
    payment_status: "captured",
    created_at: "2026-01-01T00:00:00Z",
    items: [{ id: "i1", title: "Camisa", quantity: 1, unit_price: 100 }],
    tracking: {
      tracking_number: "BR123456789BR",
      tracking_url: "https://rastreios.correios.com.br/x",
      carrier: "Correios",
    },
    metadata: { order_status_label: "Entregue" },
  },
}

/** O `FetchError` que o `@medusajs/js-sdk` lança para qualquer status >= 300. */
function erroHttp(status: number) {
  const erro = new Error(`Request failed with status ${status}`)
  ;(erro as Error & { status: number }).status = status

  return erro
}

describe("consultarRastreio", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("devolve o pedido quando a resposta traz código", async () => {
    fetchMock.mockResolvedValue(RESPOSTA_COM_RASTREIO)

    const r = await consultarRastreio("123", "12345678900", "")

    expect(r.situacao).toBe("encontrado")
  })

  it("NUNCA deixa a resposta ser cacheada", async () => {
    // A garantia central do arquivo: o CPF da cliente está na resposta.
    fetchMock.mockResolvedValue(RESPOSTA_COM_RASTREIO)

    await consultarRastreio("123", "12345678900", "")

    expect(fetchMock).toHaveBeenCalledWith(
      "/store/orders/track",
      expect.objectContaining({ cache: "no-store" })
    )
  })

  it("um pedido sem código é PENDENTE, não erro", async () => {
    // O caso comum: pago, aguardando o lojista registrar o envio. Mostrar
    // "erro" aqui diria à cliente que algo quebrou.
    fetchMock.mockResolvedValue({
      order: {
        ...RESPOSTA_COM_RASTREIO.order,
        tracking: { tracking_number: null, tracking_url: null, carrier: null },
      },
    })

    const r = await consultarRastreio("123", "12345678900", "")

    expect(r.situacao).toBe("pendente")
  })

  it("404 vira 'não encontrado'", async () => {
    fetchMock.mockRejectedValue(erroHttp(404))

    expect((await consultarRastreio("999", "12345678900", "")).situacao).toBe(
      "nao-encontrado"
    )
  })

  it("403 vira 'recusado'", async () => {
    // Identidade que não bate. A tela precisa de uma mensagem diferente da
    // de "não encontrado": aqui o pedido existe e o dado digitado está errado.
    fetchMock.mockRejectedValue(erroHttp(403))

    expect((await consultarRastreio("123", "00000000000", "")).situacao).toBe(
      "recusado"
    )
  })

  it("500 vira erro com mensagem", async () => {
    fetchMock.mockRejectedValue(erroHttp(500))

    const r = await consultarRastreio("123", "12345678900", "")

    expect(r.situacao).toBe("erro")
  })

  it("rede quebrada vira erro, não exceção", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"))

    const r = await consultarRastreio("123", "12345678900", "")

    expect(r.situacao).toBe("erro")
  })

  it("a mensagem de erro nunca inclui o CPF", async () => {
    // O erro vai para a tela e para o log do servidor. Um CPF em log é um dado
    // pessoal de cliente em texto que ninguém escolheu guardar.
    fetchMock.mockRejectedValue(erroHttp(500))

    const r = await consultarRastreio("123", "12345678900", "")

    expect(r.situacao === "erro" && r.mensagem).not.toContain("12345678900")
  })

  it("recusa pedido sem identidade ANTES de chamar a rede", async () => {
    // Sem número, ou sem CPF e sem e-mail, não há o que consultar: é uma
    // tentativa de listar pedidos, e a resposta 403 do backend não é o único
    // lugar onde isso é barrado.
    expect((await consultarRastreio("123", "", "")).situacao).toBe("erro")
    expect((await consultarRastreio("", "12345678900", "")).situacao).toBe("erro")

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("aceita e-mail no lugar do CPF", async () => {
    fetchMock.mockResolvedValue(RESPOSTA_COM_RASTREIO)

    const r = await consultarRastreio("123", "", "cliente@email.com")

    expect(r.situacao).toBe("encontrado")
  })

  it("manda o CPF quando ele foi digitado", async () => {
    fetchMock.mockResolvedValue(RESPOSTA_COM_RASTREIO)

    await consultarRastreio("123", "  12345678900  ", "")

    // Com os espaços removidos: o backend compara string, e um espaço
    // sobrando faria a consulta cair em 403 para a própria cliente.
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.query).toMatchObject({ display_id: "123", cpf: "12345678900" })
  })

  it("não manda cpf vazio junto com o e-mail", async () => {
    fetchMock.mockResolvedValue(RESPOSTA_COM_RASTREIO)

    await consultarRastreio("123", "", "cliente@email.com")

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.query.cpf).toBeUndefined()
    expect(opts.query.email).toBe("cliente@email.com")
  })
})