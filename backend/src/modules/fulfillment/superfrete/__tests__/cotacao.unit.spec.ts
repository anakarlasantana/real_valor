/** O contrato do SuperFrete e a cotação, sem rede. Doc 15. */

import {
  SERVICOS,
  cepValido,
  corpoDaCotacao,
  lerCotacoes,
  paraCentavos,
  paraQuilos,
  textoDoPrazo,
} from "../catalogo"
import { ambienteDaConfig, baseDaApi } from "../cliente"
import { cotarPedido, limparCache } from "../servico"

const caixaPadrao = {
  id: "p1",
  nome: "Caixa padrão",
  peso_gramas: 400,
  altura_cm: 10,
  largura_cm: 20,
  comprimento_cm: 30,
  padrao: true,
  ativo: true,
}

/** Só o módulo de pacotes responde: um volume de 1 kg por unidade. */
function containerCom() {
  return {
    resolve: () => ({
      volumesDoPedido: (itens: any[]) => {
        const volumes = itens.flatMap((item) =>
          Array.from({ length: item.quantidade }, () => ({
            peso_gramas: 1000,
            altura_cm: 10,
            largura_cm: 20,
            comprimento_cm: 30,
            caixa: "Caixa padrão",
          }))
        )

        return Promise.resolve(
          volumes.length === 0
            ? { ok: false, motivo: "O pedido não tem itens para enviar." }
            : { ok: true, volumes, pesoGramas: volumes.length * 1000 }
        )
      },
    }),
  }
}

const config = { token: "tok_123", ambiente: "sandbox" as const }

describe("ambiente e base", () => {
  it("produção é opt-in: ausente ou desconhecido cai no sandbox", () => {
    expect(ambienteDaConfig(undefined)).toBe("sandbox")
    expect(ambienteDaConfig("")).toBe("sandbox")
    expect(ambienteDaConfig("SandBox")).toBe("sandbox")
    expect(ambienteDaConfig("producao")).toBe("producao")
  })

  it("cada ambiente tem a sua base", () => {
    expect(baseDaApi("sandbox")).toBe("https://sandbox.superfrete.com")
    expect(baseDaApi("producao")).toBe("https://api.superfrete.com")
  })
})

describe("unidades", () => {
  it("gramas viram quilos com 3 casas, sem float sujo", () => {
    expect(paraQuilos(400)).toBe(0.4)
    expect(paraQuilos(1000)).toBe(1)
    expect(paraQuilos(1)).toBe(0.001)
    expect(String(paraQuilos(300))).toBe("0.3")
  })

  it("reais viram centavos, arredondando", () => {
    expect(paraCentavos(18.61)).toBe(1861)
    expect(paraCentavos("24.90")).toBe(2490)
    expect(paraCentavos(0.1 + 0.2)).toBe(30)
  })
})

describe("corpo da cotação", () => {
  it("manda os códigos dos Correios, o CEP só com dígitos e o peso em kg", () => {
    const corpo = corpoDaCotacao({
      cepOrigem: "01310-100",
      cepDestino: "20020-050",
      volume: { peso_gramas: 1000, altura_cm: 10, largura_cm: 20, comprimento_cm: 30 },
      servicos: ["PAC", "SEDEX", "MINI"],
    })

    expect(corpo.from.postal_code).toBe("01310100")
    expect(corpo.to.postal_code).toBe("20020050")
    expect(corpo.services).toBe("1,2,17")
    expect(corpo.package).toEqual({ height: 10, width: 20, length: 30, weight: 1 })
    expect(SERVICOS.MINI).toBe("17")
  })
})


describe("lerCotacoes", () => {
  const resposta = [
    { id: 1, name: "PAC", price: 18.61, delivery_time: 5, has_error: false },
    { id: 2, name: "SEDEX", price: 31.2, delivery_time: 1, has_error: false },
    { id: 3, name: "Jadlog", price: 20, delivery_time: 4, has_error: false },
    { id: 17, name: "MiniEnvios", price: 12, delivery_time: 8, has_error: true },
  ]

  it("lê todas as transportadoras do catálogo, com preço em centavos e prazo", () => {
    expect(lerCotacoes(resposta)).toEqual([
      { servico: "PAC", nome: "PAC", preco: 1861, prazo: 5 },
      { servico: "SEDEX", nome: "SEDEX", preco: 3120, prazo: 1 },
      { servico: "JADLOG", nome: "Jadlog", preco: 2000, prazo: 4 },
    ])
  })

  it("descarta o código que não está no catálogo, em vez de inventar", () => {
    expect(lerCotacoes([{ id: 99, name: "Outra", price: 10, delivery_time: 3 }])).toEqual([])
  })

  it("descarta o serviço com `has_error`, mesmo vindo com preço", () => {
    expect(lerCotacoes(resposta).some((c) => c.servico === "MINI")).toBe(false)
  })

  it("descarta preço zero, que seria frete grátis", () => {
    expect(
      lerCotacoes([{ id: 1, price: 0, delivery_time: 5, has_error: false }])
    ).toEqual([])
  })

  it("resposta que não é lista não estoura", () => {
    expect(lerCotacoes(undefined)).toEqual([])
    expect(lerCotacoes({ erro: true })).toEqual([])
  })

  it("o prazo vira texto de tela, no singular quando é 1", () => {
    expect(textoDoPrazo(5)).toBe("até 5 dias úteis")
    expect(textoDoPrazo(1)).toBe("até 1 dia útil")
    expect(textoDoPrazo(0)).toBe("prazo a confirmar")
  })
})

const cotar = (over: Record<string, any> = {}) =>
  cotarPedido({
    container: containerCom() as any,
    config,
    cepOrigem: "01310100",
    cepDestino: "20020050",
    itens: [{ quantidade: 1 }],
    servicos: ["PAC"],
    chamar: (async () => [
      { id: 1, price: 10, delivery_time: 5, has_error: false },
    ]) as any,
    ...over,
  })

describe("cotarPedido", () => {
  beforeEach(() => limparCache())

  it("sem CEP de origem, recusa antes de chamar a API", async () => {
    let chamou = false

    const resultado = await cotar({
      cepOrigem: "",
      chamar: async () => {
        chamou = true
        return []
      },
    })

    expect(resultado.ok).toBe(false)
    expect(chamou).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain("origem")
  })

  it("multiplica o preço pelo número de volumes: cada caixa é cobrada", async () => {
    const resultado = await cotar({ itens: [{ quantidade: 3 }] })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.volumes).toBe(3)
    expect(resultado.cotacoes[0].preco).toBe(3000)
  })

  it("cacheia a mesma pergunta por cinco minutos", async () => {
    let chamadas = 0
    const chamar = async () => {
      chamadas++
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }

    await cotar({ chamar })
    await cotar({ chamar })

    expect(chamadas).toBe(1)
  })

  it("falha da API não fica no cache: a próxima tentativa chama de novo", async () => {
    let chamadas = 0
    const chamar = async () => {
      chamadas++
      if (chamadas === 1) {
        throw Object.assign(new Error("SuperFrete respondeu 503."), { status: 503 })
      }
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }

    expect((await cotar({ chamar })).ok).toBe(false)
    expect((await cotar({ chamar })).ok).toBe(true)
    expect(chamadas).toBe(2)
  })

  it("lista vazia vira erro, nunca frete de graça", async () => {
    expect((await cotar({ chamar: async () => [] })).ok).toBe(false)
  })

  it("carrinho sem itens é 422 com o motivo", async () => {
    const resultado = await cotar({ itens: [] })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.status).toBe(422)
  })
})

describe("CEP", () => {
  it("só 8 dígitos, e nunca o CEP tudo zero", () => {
    expect(cepValido("01310-100")).toBe(true)
    expect(cepValido("0131010")).toBe(false)
    expect(cepValido("00000000")).toBe(false)
    expect(cepValido(null)).toBe(false)
  })
})
