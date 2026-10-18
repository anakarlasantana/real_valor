/** `GET /store/checkout/info`: só `documento_presente` muda com o carrinho. */
import { GET } from "../../../api/store/checkout/info/route"

type CartModule = { retrieveCart: (id: string) => Promise<unknown> }

/** Um `Res` mínimo: o handler só usa `json`. */
function fakeRes() {
  const res = {
    body: undefined as any,
    json(payload: any) {
      res.body = payload
      return res
    },
  }

  return res
}

/** O `req` mínimo: `query` e um `scope` que devolve o módulo de carrinho. */
function fakeReq(query: Record<string, unknown>, cartModule?: CartModule) {
  return {
    query,
    scope: {
      resolve: () => {
        if (!cartModule) {
          throw new Error("module not resolved")
        }
        return cartModule
      },
    },
  } as any
}

describe("GET /store/checkout/info", () => {
  it("sem carrinho: responde a loja e diz que não há documento", async () => {
    const res = fakeRes()
    await GET(fakeReq({}), res as any)

    expect(res.body.store.name).toBe("Real Valor Modas")
    expect(res.body.checkout_policy.documento_presente).toBe(false)
    expect(res.body.checkout_policy.document_required).toBe(true)
    // O que já existia continua igual: o storefront lê estes campos.
    expect(res.body.checkout_policy.accepted_documents).toEqual(["CPF"])
    expect(res.body.checkout_policy.installments.max_installments).toBe(12)
  })

  it("com carrinho e CPF válido: diz que o documento está presente", async () => {
    const res = fakeRes()

    await GET(
      fakeReq({ cart_id: "cart_1" }, {
        retrieveCart: async () => ({ id: "cart_1", metadata: { cpf: "10000000091" } }),
      }) as any,
      res as any
    )

    expect(res.body.checkout_policy.documento_presente).toBe(true)
  })

  it("aceita o CPF mascarado que estiver gravado de antes", async () => {
    const res = fakeRes()

    await GET(
      fakeReq({ cart_id: "cart_1" }, {
        retrieveCart: async () => ({
          id: "cart_1",
          metadata: { cpf: "100.000.000-91" },
        }),
      }) as any,
      res as any
    )

    expect(res.body.checkout_policy.documento_presente).toBe(true)
  })

  it("CPF inválido não conta como documento", async () => {
    const res = fakeRes()

    await GET(
      fakeReq({ cart_id: "cart_1" }, {
        retrieveCart: async () => ({ id: "cart_1", metadata: { cpf: "12345678900" } }),
      }) as any,
      res as any
    )

    expect(res.body.checkout_policy.documento_presente).toBe(false)
  })

  it("carrinho que não existe não derruba a resposta", async () => {
    const res = fakeRes()

    await GET(
      fakeReq({ cart_id: "cart_sumiu" }, {
        retrieveCart: async () => {
          throw new Error("Cart not found")
        },
      }) as any,
      res as any
    )

    expect(res.body.store.name).toBe("Real Valor Modas")
    expect(res.body.checkout_policy.documento_presente).toBe(false)
  })

  it("carrinho sem metadata é 'sem documento', não erro", async () => {
    const res = fakeRes()

    await GET(
      fakeReq({ cart_id: "cart_1" }, {
        retrieveCart: async () => ({ id: "cart_1", metadata: null }),
      }) as any,
      res as any
    )

    expect(res.body.checkout_policy.documento_presente).toBe(false)
  })
})
