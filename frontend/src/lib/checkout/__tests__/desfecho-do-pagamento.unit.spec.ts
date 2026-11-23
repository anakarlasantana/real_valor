import { describe, expect, it } from "vitest"

import { desfechoDaResposta } from "../desfecho-do-pagamento"

describe("desfechoDaResposta", () => {
  it("pedido encontrado manda a cliente para a confirmação", () => {
    expect(desfechoDaResposta(200, { encontrado: true, id: "order_1" })).toEqual({
      tipo: "pedido",
      id: "order_1",
    })
  })

  it("404 com pagamento recusado encerra a espera", () => {
    expect(
      desfechoDaResposta(404, { encontrado: false, pagamento: "recusado" })
    ).toEqual({ tipo: "recusado" })
  })

  it("404 com pagamento pendente continua aguardando", () => {
    expect(
      desfechoDaResposta(404, { encontrado: false, pagamento: "pendente" })
    ).toEqual({ tipo: "aguardando" })

    expect(
      desfechoDaResposta(404, { encontrado: false, pagamento: null })
    ).toEqual({ tipo: "aguardando" })
  })

  it("200 sem id é aguardando, não erro", () => {
    expect(desfechoDaResposta(200, { encontrado: false })).toEqual({
      tipo: "aguardando",
    })
  })

  it("503 é loja mal configurada, e não adianta insistir", () => {
    expect(desfechoDaResposta(503, {})).toEqual({ tipo: "indisponivel" })
  })

  it("502 e queda de rede pedem nova tentativa", () => {
    expect(desfechoDaResposta(502, {})).toEqual({ tipo: "esperar" })
    expect(desfechoDaResposta(0, null)).toEqual({ tipo: "esperar" })
  })
})
