import { pesoTaxavel, type Pacote } from "../../pacotes/pacotes"
import {
  estaAtiva,
  mudancas,
  opcoesDoServico,
  problemaDasEscolhas,
  regrasDeAtivacao,
  servicoDaOpcao,
} from "../servicos"
import { testarCotacao, type Chamar } from "../servico"

const opcao = (extra: Record<string, any> = {}) => ({
  id: "so_pac",
  name: "PAC",
  price_type: "calculated",
  data: { servico: "PAC" },
  rules: [{ attribute: "enabled_in_store", value: "true" }],
  type: { code: "correios_pac" },
  ...extra,
})

const caixa: Pacote = {
  id: "p1",
  nome: "Padrão",
  peso_gramas: 300,
  altura_cm: 10,
  largura_cm: 20,
  comprimento_cm: 30,
  padrao: true,
  ativo: true,
}

describe("servicoDaOpcao", () => {
  it("lê o serviço do `data`, que é o que chega ao calculatePrice", () => {
    expect(servicoDaOpcao({ data: { servico: "SEDEX" } })).toBe("SEDEX")
  })

  it("aceita minúsculas e espaços, porque é texto editado por gente", () => {
    expect(servicoDaOpcao({ data: { servico: " mini " } })).toBe("MINI")
  })

  it("cai no `type.code` do seed quando o `data` está vazio", () => {
    expect(servicoDaOpcao({ data: {}, type: { code: "correios_sedex" } })).toBe(
      "SEDEX",
    )
  })

  it("devolve null para a opção que não diz serviço nenhum", () => {
    expect(servicoDaOpcao({ data: {}, type: { code: "manual" } })).toBeNull()
    expect(servicoDaOpcao({ data: { servico: "CORREIOS" } })).toBeNull()
  })

  it("reconhece as transportadoras além dos Correios", () => {
    expect(servicoDaOpcao({ data: { servico: "JADLOG" } })).toBe("JADLOG")
    expect(servicoDaOpcao({ data: { servico: "jnt" } })).toBe("JNT")
    expect(servicoDaOpcao({ data: { servico: "Loggi" } })).toBe("LOGGI")
  })

  it("não confunde uma chave qualquer do objeto com serviço", () => {
    expect(servicoDaOpcao({ data: { servico: "toString" } })).toBeNull()
  })
})

describe("estaAtiva", () => {
  it("sem a regra, a opção vale — é o padrão do Medusa", () => {
    expect(estaAtiva({ rules: [] })).toBe(true)
    expect(estaAtiva({})).toBe(true)
  })

  it("só `false` desliga", () => {
    expect(
      estaAtiva({ rules: [{ attribute: "enabled_in_store", value: "false" }] }),
    ).toBe(false)
    expect(
      estaAtiva({ rules: [{ attribute: "enabled_in_store", value: "true" }] }),
    ).toBe(true)
  })

  it("ignora regras de outro atributo", () => {
    expect(
      estaAtiva({ rules: [{ attribute: "is_return", value: "false" }] }),
    ).toBe(true)
  })
})

describe("opcoesDoServico", () => {
  it("ordena os Correios primeiro, depois as outras transportadoras", () => {
    const lidas = opcoesDoServico([
      opcao({ id: "l", name: "Loggi", data: { servico: "LOGGI" } }),
      opcao({ id: "m", name: "Mini Envios", data: { servico: "MINI" } }),
      opcao({ id: "s", name: "SEDEX", data: { servico: "SEDEX" } }),
      opcao({ id: "j", name: "Jadlog", data: { servico: "JADLOG" } }),
      opcao({ id: "p", name: "PAC", data: { servico: "PAC" } }),
      opcao({ id: "t", name: "J&T", data: { servico: "JNT" } }),
    ])

    expect(lidas.map((o) => o.servico)).toEqual([
      "PAC",
      "SEDEX",
      "MINI",
      "JADLOG",
      "JNT",
      "LOGGI",
    ])
  })

  it("joga a opção sem serviço para o fim, não para o topo", () => {
    const lidas = opcoesDoServico([
      opcao({ id: "x", name: "Manual", data: {}, type: { code: "manual" } }),
      opcao({ id: "p", name: "PAC", data: { servico: "PAC" } }),
    ])

    expect(lidas.map((o) => o.id)).toEqual(["p", "x"])
  })

  it("diz a transportadora de cada serviço, para a tela não chutar", () => {
    const lidas = opcoesDoServico([
      opcao({ id: "p", data: { servico: "PAC" } }),
      opcao({ id: "j", data: { servico: "JADLOG" } }),
      opcao({ id: "t", data: { servico: "JNT" } }),
    ])

    expect(lidas.map((o) => o.transportadora)).toEqual([
      "Correios",
      "Jadlog",
      "J&T",
    ])
  })

  it("marca o preço fixo, que a cotação não usa", () => {
    const [lida] = opcoesDoServico([opcao({ price_type: "flat" })])

    expect(lida.precoFixo).toBe(true)
  })
})

describe("problemaDasEscolhas", () => {
  it("recusa a lista vazia", () => {
    expect(problemaDasEscolhas([])?.status).toBe(400)
  })

  it("recusa escolha sem id", () => {
    expect(problemaDasEscolhas([{ id: "", ativo: true }])?.status).toBe(400)
  })

  it("recusa desligar tudo: checkout sem entrega", () => {
    const problema = problemaDasEscolhas([
      { id: "a", ativo: false },
      { id: "b", ativo: false },
    ])

    expect(problema?.status).toBe(422)
    expect(problema?.mensagem).toContain("ao menos um")
  })

  it("aceita um ligado entre desligados", () => {
    expect(
      problemaDasEscolhas([
        { id: "a", ativo: false },
        { id: "b", ativo: true },
      ]),
    ).toBeNull()
  })

  it("aceita desligar UMA quando as outras seguem ligadas", () => {
    const atuais = opcoesDoServico([
      opcao({ id: "p", data: { servico: "PAC" } }),
      opcao({ id: "j", data: { servico: "JADLOG" } }),
    ])

    expect(problemaDasEscolhas([{ id: "j", ativo: false }], atuais)).toBeNull()
  })

  it("recusa quando o estado final deixa todas desligadas", () => {
    const atuais = opcoesDoServico([
      opcao({ id: "p", data: { servico: "PAC" } }),
      opcao({
        id: "j",
        data: { servico: "JADLOG" },
        rules: [{ attribute: "enabled_in_store", value: "false" }],
      }),
    ])

    expect(problemaDasEscolhas([{ id: "p", ativo: false }], atuais)?.status).toBe(
      422,
    )
  })
})

describe("mudancas", () => {
  const atuais = opcoesDoServico([
    opcao({ id: "p", data: { servico: "PAC" } }),
    opcao({
      id: "s",
      data: { servico: "SEDEX" },
      rules: [{ attribute: "enabled_in_store", value: "false" }],
    }),
  ])

  it("só grava o que mudou", () => {
    expect(mudancas(atuais, [{ id: "s", ativo: true }])).toEqual([
      { id: "s", ativa: true },
    ])
  })

  it("não grava nada quando a escolha repete o estado", () => {
    expect(
      mudancas(atuais, [
        { id: "p", ativo: true },
        { id: "s", ativo: false },
      ]),
    ).toEqual([])
  })
})

describe("regrasDeAtivacao", () => {
  it("reescreve a regra inteira, para não acumular duas", () => {
    expect(regrasDeAtivacao(false)).toEqual([
      { attribute: "enabled_in_store", value: "false", operator: "eq" },
    ])
  })
})

describe("testarCotacao", () => {
  const config = { token: "t", ambiente: "sandbox" as const }
  // O que a rota do admin passa: a base do ambiente e o User-Agent da loja.
  const base = "https://sandbox.superfrete.com"
  const userAgent = "RealValor v1.0.0 (userealvalor@gmail.com)"
  const daRota = { config, base, userAgent }

  it("cota com a caixa padrão e o peso taxável", async () => {
    const chamadas: any[] = []
    const resposta = [
      {
        id: 1,
        name: "PAC",
        price: "27.40",
        delivery_time: 8,
        has_error: false,
      },
    ]

    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC"],
      chamar: (async (args: any) => {
        chamadas.push(args)
        return resposta
      }) as Chamar,
    })

    expect(resultado.ok).toBe(true)
    expect(chamadas[0].caminho).toBe("/api/v0/calculator")
    expect(chamadas[0].corpo.package.weight).toBe(1)
    expect(chamadas[0].corpo.from.postal_code).toBe("01310100")
  })

  it("sem caixa ativa, não chama a API", async () => {
    let chamou = false

    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [{ ...caixa, ativo: false }],
      servicos: ["PAC"],
      chamar: (async () => {
        chamou = true
        return {}
      }) as Chamar,
    })

    expect(resultado).toMatchObject({
      ok: false,
      status: 422,
      erro: "Nenhuma caixa ativa e válida para cotar.",
    })
    expect(chamou).toBe(false)
  })

  it("sem CEP de origem, aponta o centro de distribuição", async () => {
    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC"],
      chamar: (async () => ({})) as Chamar,
    })

    expect(resultado.ok).toBe(false)
    expect(resultado.ok === false && resultado.erro).toContain(
      "centro de distribuição",
    )
  })

  it("devolve o status do erro do cliente, não 200 vazio", async () => {
    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC"],
      chamar: (async () => {
        throw Object.assign(new Error("SuperFrete respondeu 503."), {
          status: 503,
        })
      }) as Chamar,
    })

    expect(resultado).toMatchObject({ ok: false, status: 503 })
  })

  it("devolve a requisição enviada, com o token mascarado e sem vazá-lo", async () => {
    const token = "tok_secreto_123"
    const resultado = await testarCotacao({
      ...daRota,
      config: { ...config, token },
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC", "SEDEX"],
      chamar: (async () => [
        { id: 1, name: "PAC", price: 10, delivery_time: 5, has_error: false },
        { id: 2, name: "SEDEX", price: 20, delivery_time: 2, has_error: false },
      ]) as Chamar,
    })

    expect(resultado.requisicao.url).toBe(`${base}/api/v0/calculator`)
    expect(resultado.requisicao.corpo).toMatchObject({
      from: { postal_code: "01310100" },
      to: { postal_code: "20040020" },
      services: "1,2",
    })
    expect(resultado.requisicao.cabecalhos["User-Agent"]).toBe(userAgent)
    // O token de verdade não aparece em lugar nenhum da resposta de teste.
    expect(JSON.stringify(resultado)).not.toContain(token)
    // O teste nunca passa pelo cache: sempre vai à rede.
    expect(resultado.origem).toBe("rede")
  })

  it("mede a latência com o relógio injetado", async () => {
    let agora = 1_000

    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC"],
      relogio: () => agora,
      chamar: (async () => {
        agora += 250
        return [{ id: 1, name: "PAC", price: 10, delivery_time: 5, has_error: false }]
      }) as Chamar,
    })

    expect(resultado.latenciaMs).toBe(250)
  })

  it("na falha da API, a requisição vai junto com o status", async () => {
    const resultado = await testarCotacao({
      ...daRota,
      cepOrigem: "01310100",
      cepDestino: "20040020",
      caixas: [caixa],
      servicos: ["PAC"],
      chamar: (async () => {
        throw Object.assign(new Error("SuperFrete respondeu 400 — {invalid}"), {
          status: 400,
        })
      }) as Chamar,
    })

    expect(resultado).toMatchObject({ ok: false, status: 400 })
    expect(resultado.requisicao.corpo.services).toBe("1")
  })
})

describe("peso da cotação de teste", () => {
  it("usa o peso taxável da caixa, não o declarado", () => {
    expect(pesoTaxavel({ ...caixa, peso_gramas: 100 })).toBe(1000)
  })
})
