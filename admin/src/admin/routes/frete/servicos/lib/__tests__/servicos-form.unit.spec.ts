import {
  corpoDosServicos,
  escolhasDosServicos,
  motivoDaAusencia,
  nadaAtivo,
  prazoDaCotacao,
  problemaDaCotacao,
  reaisDaCotacao,
  rotuloDaCotacao,
  servicosDoTeste,
  testaveis,
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
