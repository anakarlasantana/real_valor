import {
  corpoDosServicos,
  curlDaCotacao,
  escolhasDosServicos,
  motivoDaAusencia,
  nadaAtivo,
  origemDaCotacao,
  prazoDaCotacao,
  problemaDaCotacao,
  reaisDaCotacao,
  rotuloDaCotacao,
  servicosDoCorpo,
  servicosDoTeste,
  tempoDaCotacao,
  testaveis,
  type RequisicaoDaCotacao,
  type ServicoDaTela,
} from "../servicos-form"

const servicos: ServicoDaTela[] = [
  {
    id: "so_pac",
    nome: "PAC",
    servico: "PAC",
    transportadora: "Correios",
    ativa: true,
    precoFixo: false,
  },
  {
    id: "so_sedex",
    nome: "SEDEX",
    servico: "SEDEX",
    transportadora: "Correios",
    ativa: false,
    precoFixo: false,
  },
]

describe("escolhasDosServicos", () => {
  it("começa com o estado do banco, não com tudo ligado", () => {
    expect(escolhasDosServicos(servicos)).toEqual({
      so_pac: true,
      so_sedex: false,
    })
  })

  it("aguenta a lista vazia", () => {
    expect(escolhasDosServicos([])).toEqual({})
  })
})

describe("corpoDosServicos", () => {
  it("manda a lista no formato que o PUT lê", () => {
    expect(corpoDosServicos({ so_pac: false, so_sedex: true })).toEqual({
      servicos: [
        { id: "so_pac", ativo: false },
        { id: "so_sedex", ativo: true },
      ],
    })
  })

  it("normaliza o que não é booleano", () => {
    expect(corpoDosServicos({ so_pac: "sim" as unknown as boolean })).toEqual({
      servicos: [{ id: "so_pac", ativo: true }],
    })
  })
})

describe("nadaAtivo", () => {
  it("avisa antes de salvar, porque o backend recusaria com 422", () => {
    expect(nadaAtivo({ so_pac: false, so_sedex: false })).toBe(true)
  })

  it("um ligado basta", () => {
    expect(nadaAtivo({ so_pac: true, so_sedex: false })).toBe(false)
  })

  it('sem serviço nenhum não é "nada ativo": é loja não semeada', () => {
    expect(nadaAtivo({})).toBe(false)
  })
})

describe("problemaDaCotacao", () => {
  it("exige 8 dígitos", () => {
    expect(problemaDaCotacao("20040-02", 1)).toContain("8 dígitos")
  })

  it("não exige serviço ligado: o teste inclui os desligados", () => {
    expect(problemaDaCotacao("20040020", 3)).toBeNull()
  })

  it("exige ao menos uma opção com serviço", () => {
    expect(problemaDaCotacao("20040020", 0)).toContain("seed")
  })

  it("passa com CEP formatado e um serviço", () => {
    expect(problemaDaCotacao("20040-020", 1)).toBeNull()
  })

  it("recusa CEP vazio", () => {
    expect(problemaDaCotacao("", 2)).toContain("CEP")
  })
})

describe("testaveis e servicosDoTeste", () => {
  const comVazia: ServicoDaTela[] = [
    ...servicos,
    { id: "x", nome: "Manual", servico: null, transportadora: null, ativa: false, precoFixo: true },
  ]

  it("conta só as opções que sabem qual serviço são", () => {
    expect(testaveis(comVazia)).toBe(2)
  })

  it("lista os serviços na ordem da tela, sem a opção vazia", () => {
    expect(servicosDoTeste(comVazia)).toEqual(["PAC", "SEDEX"])
  })
})

describe("motivoDaAusencia", () => {
  it("distingue desligado de não cotou", () => {
    expect(motivoDaAusencia("SEDEX", servicos)).toContain("Desligado")
    expect(motivoDaAusencia("PAC", servicos)).toContain("Não cotou")
  })
})

describe("rotuloDaCotacao no resultado do teste", () => {
  it("marca o desligado em vez de escondê-lo", () => {
    expect(
      rotuloDaCotacao({ servico: "JADLOG", nome: "Jadlog", preco: 20, prazo: 4, ativo: false }),
    ).toBe("Jadlog (desligado)")
    expect(
      rotuloDaCotacao({ servico: "PAC", nome: "PAC", preco: 18, prazo: 5, ativo: true }),
    ).toBe("PAC")
  })
})

describe("reaisDaCotacao", () => {
  it("formata centavos com vírgula e dois dígitos", () => {
    expect(reaisDaCotacao(2740)).toBe("R$ 27,40")
    expect(reaisDaCotacao(5)).toBe("R$ 0,05")
    expect(reaisDaCotacao(100000)).toBe("R$ 1000,00")
  })

  it("não mostra preço negativo", () => {
    expect(reaisDaCotacao(-10)).toBe("R$ 0,00")
  })
})

describe("prazoDaCotacao", () => {
  it("usa singular num dia", () => {
    expect(prazoDaCotacao(1)).toBe("1 dia útil")
  })

  it("usa plural acima disso", () => {
    expect(prazoDaCotacao(8)).toBe("8 dias úteis")
  })

  it("diz quando não há prazo, em vez de mostrar 0", () => {
    expect(prazoDaCotacao(0)).toBe("prazo não informado")
  })
})

describe("rotuloDaCotacao", () => {
  it("cai no código quando o nome vem vazio", () => {
    expect(
      rotuloDaCotacao({ servico: "PAC", nome: "", preco: 1, prazo: 1 }),
    ).toBe("PAC")
  })
})

const requisicao: RequisicaoDaCotacao = {
  metodo: "POST",
  url: "https://sandbox.superfrete.com/api/v0/calculator",
  caminho: "/api/v0/calculator",
  cabecalhos: {
    Authorization: "Bearer ••••••••",
    "User-Agent": "RealValor v1.0.0 (userealvalor@gmail.com)",
    accept: "application/json",
    "content-type": "application/json",
  },
  corpo: {
    from: { postal_code: "01310100" },
    to: { postal_code: "20040020" },
    services: "1,2,99",
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: 0,
      use_insurance_value: false,
    },
    package: { height: 10, width: 20, length: 30, weight: 1 },
  },
}

describe("auditoria da cotação", () => {
  const AP = String.fromCharCode(39)
  const BS = String.fromCharCode(92)
  it("ordem dos serviços vira nome, e o desconhecido mantém o código", () => {
    expect(servicosDoCorpo(requisicao.corpo, servicos)).toBe(
      "PAC, SEDEX, código 99",
    )
  })

  it("a origem fala português e não inventa valor", () => {
    expect(origemDaCotacao("rede")).toBe("resposta da API")
    expect(origemDaCotacao("redis")).toBe("cache do Redis")
    expect(origemDaCotacao("memoria")).toBe("cache em memória")
    expect(origemDaCotacao(undefined)).toBe("origem não informada")
  })

  it("tempo curto em ms, longo em segundos", () => {
    expect(tempoDaCotacao(0)).toBe("0 ms")
    expect(tempoDaCotacao(180)).toBe("180 ms")
    expect(tempoDaCotacao(1200)).toBe("1,2 s")
    expect(tempoDaCotacao(NaN)).toBe("0 ms")
  })

  it("o cURL leva método, URL, cabeçalhos e o corpo exato", () => {
    const curl = curlDaCotacao(requisicao)

    expect(curl).toContain("curl -X POST 'https://sandbox.superfrete.com/api/v0/calculator'")
    expect(curl).toContain("-H 'content-type: application/json'")
    expect(curl).toContain('--data-raw \'{\n  "from"')
    expect(curl).toContain('"services": "1,2,99"')
  })

  it("o token nunca entra no cURL: sai como variável de ambiente", () => {
    const curl = curlDaCotacao(requisicao)

    expect(curl).toContain("-H 'Authorization: Bearer $SUPERFRETE_TOKEN'")
    expect(curl).not.toContain("••••••••")
  })

  it("aspas simples no cabeçalho não quebram o comando", () => {
    const comAspas: RequisicaoDaCotacao = {
      ...requisicao,
      cabecalhos: { ...requisicao.cabecalhos, "User-Agent": "RealValor's app" },
    }
    const curl = curlDaCotacao(comAspas)

    // A sequência shell é: fecha a aspa, escapa a aspa, reabre a aspa.
    // A aspa entra escapada: fecha, contrabarra, aspa, aspa.
    expect(curl).toContain("-H " + AP + "User-Agent: RealValor" + AP + BS + AP + AP + "s app" + AP)

  })
})

/**
 * O que "Copiar como cURL" entrega: cada argumento numa linha, terminada em
 * contrabarra, para colar no terminal de uma vez.
 */
describe("saída do cURL", () => {
  const BS = String.fromCharCode(92)
  const NL = String.fromCharCode(10)

  it("cada argumento do comando termina em contrabarra, antes do corpo", () => {
    const linhas = curlDaCotacao(requisicao).split(NL)
    const corpo = linhas.findIndex((linha) => linha.includes("--data-raw"))

    // URL + 4 cabeçalhos vêm antes do corpo.
    expect(corpo).toBe(5)

    for (const linha of linhas.slice(0, corpo)) {
      expect(linha.endsWith(" " + BS)).toBe(true)
    }

    expect(linhas[0]).toContain("calculator")
    expect(linhas[0].endsWith(" " + BS)).toBe(true)
  })
})
