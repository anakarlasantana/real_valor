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
import {
  chaveDaCotacao,
  cotarPedido,
  invalidarCache,
  limparCache,
  registrarCache,
} from "../servico"

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

  it("o erro também diz de onde veio — a tela não fica adivinhando", async () => {
    const falha = await cotar({
      chamar: async () => {
        throw Object.assign(new Error("SuperFrete respondeu 401."), { status: 401 })
      },
    })

    expect(falha.ok).toBe(false)
    expect(falha.origem).toBe("rede")
  })

  it("carrinho sem itens é 422 com o motivo", async () => {
    const resultado = await cotar({ itens: [] })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.status).toBe(422)
  })

  it("a primeira cotação vem da rede e a segunda da memória", async () => {
    const primeira = await cotar()
    const segunda = await cotar()

    expect(primeira.ok && primeira.origem).toBe("rede")
    expect(segunda.ok && segunda.origem).toBe("memoria")
  })

  it("ordem dos serviços não cria chave nova", async () => {
    let chamadas = 0
    const chamar = (async () => {
      chamadas++
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }) as any

    await cotar({ chamar, servicos: ["PAC", "SEDEX"] })
    await cotar({ chamar, servicos: ["SEDEX", "PAC"] })

    expect(chamadas).toBe(1)
  })

  it("`force` ignora as duas camadas — é o teste do admin", async () => {
    let chamadas = 0
    const chamar = (async () => {
      chamadas++
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }) as any

    await cotar({ chamar })
    const forcada = await cotar({ chamar, force: true })

    expect(chamadas).toBe(2)
    expect(forcada.ok && forcada.origem).toBe("rede")
  })

  it("a segunda camada (Redis) responde quando a memória está vazia", async () => {
    const guardado = new Map<string, unknown>()
    const fake = {
      get: async <T,>(chave: string) => (guardado.get(chave) ?? null) as T | null,
      set: async (chave: string, dados: unknown) => {
        guardado.set(chave, dados)
      },
      invalidate: async (padrao: string) => {
        const prefixo = padrao.replace(/\*$/, "")

        for (const chave of [...guardado.keys()]) {
          if (chave.startsWith(prefixo)) {
            guardado.delete(chave)
          }
        }
      },
      clear: async () => {
        throw new Error("clear() é FLUSHDB: derrubaria as sessões do painel")
      },
    }

    // O container que a rota do checkout entrega resolve o `Modules.CACHE`.
    const containerComCache = {
      resolve: (chave: string) => {
        if (chave === "cache") return fake

        return containerCom().resolve() as any
      },
    }

    let chamadas = 0
    const chamar = (async () => {
      chamadas++
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }) as any

    registrarCache(containerComCache as any)
    await cotarPedido({
      container: containerComCache as any,
      config,
      cepOrigem: "01310100",
      cepDestino: "20020050",
      itens: [{ quantidade: 1 }],
      servicos: ["PAC"],
      chamar,
    })

    // Restart do processo: a memória some, o Redis não.
    limparCache()

    const segunda = await cotarPedido({
      container: containerComCache as any,
      config,
      cepOrigem: "01310100",
      cepDestino: "20020050",
      itens: [{ quantidade: 1 }],
      servicos: ["PAC"],
      chamar,
    })

    expect(chamadas).toBe(1)
    expect(segunda.ok && segunda.origem).toBe("redis")

    // Volta ao estado sem cache para não vazar para os outros testes: o
    // registro da L2 é global, então ele é desfeito aqui.
    await fake.invalidate("cotacao*")
    limparCache()
  })

  it("requisições simultâneas iguais fazem uma chamada só", async () => {
    let chamadas = 0
    const chamar = (async () => {
      chamadas++
      await new Promise((r) => setTimeout(r, 10))
      return [{ id: 1, price: 10, delivery_time: 5, has_error: false }]
    }) as any

    const [a, b] = await Promise.all([cotar({ chamar }), cotar({ chamar })])

    expect(chamadas).toBe(1)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
  })

  it("peso acima do teto da transportadora nem vai à API", async () => {
    let chamou = false

    const resultado = await cotarPedido({
      // Um volume de 20 kg: a J&T para em 11 kg.
      container: {
        resolve: () => ({
          volumesDoPedido: async () => ({
            ok: true,
            volumes: [
              {
                peso_gramas: 20_000,
                altura_cm: 10,
                largura_cm: 20,
                comprimento_cm: 30,
                caixa: "Caixa padrão",
              },
            ],
            pesoGramas: 20_000,
          }),
        }),
      } as any,
      config,
      cepOrigem: "01310100",
      cepDestino: "20020050",
      itens: [{ quantidade: 1 }],
      servicos: ["JNT"],
      chamar: (async () => {
        chamou = true
        return []
      }) as any,
    })

    expect(resultado.ok).toBe(false)
    expect(chamou).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain("11 kg")
  })
})

describe("chaveDaCotacao", () => {
  const base = {
    config,
    cepOrigem: "01310100",
    cepDestino: "20020050",
    volume: { peso_gramas: 1000, altura_cm: 10, largura_cm: 20, comprimento_cm: 30 },
  }

  it("ignora a ordem dos serviços e arredonda o float do peso", () => {
    const a = chaveDaCotacao({ ...base, servicos: ["PAC", "SEDEX"] })
    const b = chaveDaCotacao({ ...base, servicos: ["SEDEX", "PAC"] })
    const c = chaveDaCotacao({
      ...base,
      volume: { ...base.volume, peso_gramas: 0.1 + 0.2 },
      servicos: ["PAC", "SEDEX"],
    })
    const d = chaveDaCotacao({
      ...base,
      volume: { ...base.volume, peso_gramas: 0.3 },
      servicos: ["PAC", "SEDEX"],
    })

    expect(a).toBe(b)
    expect(c).toBe(d)
  })

  it("ambiente e destino fazem parte da chave", () => {
    const sandbox = chaveDaCotacao({ ...base, servicos: ["PAC"] })
    const producao = chaveDaCotacao({
      ...base,
      config: { ...config, ambiente: "producao" },
      servicos: ["PAC"],
    })
    const outroCep = chaveDaCotacao({
      ...base,
      cepDestino: "30130010",
      servicos: ["PAC"],
    })

    expect(sandbox).not.toBe(producao)
    expect(sandbox).not.toBe(outroCep)
  })
})

describe("invalidarCache", () => {
  beforeEach(() => limparCache())
  afterEach(() => limparCache())

  const base = {
    config,
    cepOrigem: "01310100",
    cepDestino: "20020050",
    volume: { peso_gramas: 1000, altura_cm: 10, largura_cm: 20, comprimento_cm: 30 },
  }

  it("apaga só as chaves da cotação — nunca o Redis inteiro", async () => {
    const guardado = new Map<string, unknown>([
      // A sessão do painel mora no MESMO Redis do cache.
      ["sess:abc", { userId: "u1" }],
    ])
    const pedidos: string[] = []

    registrarCache({
      resolve: (chave: string) =>
        chave === "cache"
          ? {
              get: async <T,>(k: string) => (guardado.get(k) ?? null) as T | null,
              set: async (k: string, dados: unknown) => {
                guardado.set(k, dados)
              },
              invalidate: async (padrao: string) => {
                pedidos.push(padrao)
                guardado.delete(chaveDaCotacao({ ...base, servicos: ["PAC"] }))
              },
            }
          : undefined,
    } as any)

    guardado.set(chaveDaCotacao({ ...base, servicos: ["PAC"] }), [])

    await invalidarCache()

    expect(pedidos).toEqual(["cotacao*"])
    expect(guardado.has("sess:abc")).toBe(true)
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
