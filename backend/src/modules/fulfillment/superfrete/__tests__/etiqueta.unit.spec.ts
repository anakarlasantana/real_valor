/** A etiqueta: montar, pagar, cancelar — sem rede. Doc 15. */

import {
  cancelarEtiqueta,
  caixaDoEnvio,
  corpoDoCarrinho,
  emitirEtiqueta,
  linkDeRastreio,
  nomeCompleto,
  problemaDaEtiqueta,
  saldoDaCarteira,
  situacaoDaEtiqueta,
  urlDaEtiqueta,
  type Chamar,
  type PedidoParaEtiqueta,
} from "../etiqueta"
import {
  cpfDoPedido,
  destinatarioDoPedido,
  pago,
  produtosDoPedido,
  remetenteDoLocal,
  separarRua,
  servicoDaOpcao,
} from "../pedido"

const caixa = {
  id: "p1",
  nome: "Caixa padrão",
  peso_gramas: 400,
  altura_cm: 10,
  largura_cm: 20,
  comprimento_cm: 30,
  padrao: true,
  ativo: true,
}

const remetente = {
  nome: "RealValor",
  documento: "12345678000199",
  telefone: "11999998888",
  email: "contato@realvalor.com.br",
  cep: "01310-100",
  rua: "Av Paulista",
  numero: "1000",
  complemento: "",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
}

const destinatario = {
  nome: "Maria Silva",
  documento: "12345678901",
  email: "maria@exemplo.com",
  telefone: "21988887777",
  cep: "20040-020",
  rua: "Rua da Assembleia",
  numero: "10",
  complemento: "apto 4",
  bairro: "Centro",
  cidade: "Rio de Janeiro",
  estado: "RJ",
}

const pedido: PedidoParaEtiqueta = {
  numero: 1042,
  servico: "SEDEX",
  remetente,
  destinatario,
  produtos: [{ nome: "Kit RealValor", quantidade: 2, valorCentavos: 12990 }],
  pago: true,
}

const config = { token: "token-de-teste", ambiente: "sandbox" as const }

describe("problemaDaEtiqueta", () => {
  it("deixa passar um pedido completo", () => {
    expect(problemaDaEtiqueta(pedido)).toBeNull()
  })

  it("recusa pedido não pago com 409 — é o caso do checkout abandonado", () => {
    const problema = problemaDaEtiqueta({ ...pedido, pago: false })
    expect(problema?.status).toBe(409)
    expect(problema?.mensagem).toContain("não está pago")
  })

  it("recusa destinatário sem CPF: a etiqueta não sai sem ele", () => {
    const problema = problemaDaEtiqueta({
      ...pedido,
      destinatario: { ...destinatario, documento: "" },
    })
    expect(problema?.status).toBe(422)
    expect(problema?.mensagem).toContain("CPF")
  })

  it("junta todos os campos que faltam numa mensagem só", () => {
    const problema = problemaDaEtiqueta({
      ...pedido,
      destinatario: { ...destinatario, cep: "", bairro: "", estado: "" },
    })
    expect(problema?.mensagem).toContain("CEP")
    expect(problema?.mensagem).toContain("bairro")
    expect(problema?.mensagem).toContain("estado")
  })

  it("recusa remetente incompleto — o erro é do centro de distribuição", () => {
    const problema = problemaDaEtiqueta({
      ...pedido,
      remetente: { ...remetente, cep: "" },
    })
    expect(problema?.mensagem).toContain("centro de distribuição")
  })

  it("recusa um pedido sem itens", () => {
    expect(problemaDaEtiqueta({ ...pedido, produtos: [] })?.mensagem).toContain("itens")
  })
})

describe("caixaDoEnvio", () => {
  it("escolhe a caixa padrão", () => {
    const outra = { ...caixa, id: "p2", nome: "Grande", padrao: false, peso_gramas: 9000 }
    expect(caixaDoEnvio([outra, caixa])?.id).toBe("p1")
  })

  it("ignora caixa inativa e devolve null quando não sobra nenhuma", () => {
    expect(caixaDoEnvio([{ ...caixa, ativo: false }])).toBeNull()
  })
})

describe("nomeCompleto", () => {
  it("prefixa nome de uma palavra: a API exige nome e sobrenome", () => {
    expect(nomeCompleto("RealValor")).toBe("Loja RealValor")
  })

  it("não mexe em nome que já tem sobrenome", () => {
    expect(nomeCompleto("Maria Silva")).toBe("Maria Silva")
  })
})


describe("corpoDoCarrinho", () => {
  const corpo = corpoDoCarrinho(pedido, caixa)

  it("manda o código do serviço, não o rótulo", () => {
    expect(corpo.service).toBe(2)
  })

  it("manda o CEP só com dígitos", () => {
    expect(corpo.to.postal_code).toBe("20040020")
    expect(corpo.from.postal_code).toBe("01310100")
  })

  it("manda o estado em caixa alta", () => {
    expect(corpo.to.state_abbr).toBe("RJ")
  })

  it("converte o valor unitário de centavos para reais", () => {
    expect(corpo.products[0]).toEqual({
      name: "Kit RealValor",
      quantity: 2,
      unitary_value: 129.9,
    })
  })

  it("usa o volume da caixa padrão, com o peso taxável mínimo", () => {
    // `pesoTaxavel` tem piso: os Correios não aceitam 0,4 kg.
    expect(corpo.volumes).toEqual({ height: 10, width: 20, length: 30, weight: 1 })
  })

  it("identifica o pedido na plataforma", () => {
    expect(corpo.platform).toBe("RealValor #1042")
  })
})

describe("emitirEtiqueta", () => {
  const chamadas: Array<{ caminho: string; corpo: any }> = []

  const responder = (respostas: Record<string, unknown>): Chamar => {
    chamadas.length = 0

    return (async (args: any) => {
      chamadas.push({ caminho: args.caminho, corpo: args.corpo })
      if (args.caminho in respostas) {
        const valor = respostas[args.caminho]
        if (valor instanceof Error) throw valor
        return valor
      }
      throw new Error(`sem resposta para ${args.caminho}`)
    }) as Chamar
  }

  it("cria no /cart e paga no /checkout, nesta ordem", async () => {
    const resultado = await emitirEtiqueta({
      pedido,
      caixa,
      config,
      chamar: responder({
        "/api/v0/cart": { id: "abc123", price: 34.27, status: "pending" },
        "/api/v0/checkout": {},
      }),
    })

    expect(chamadas.map((c) => c.caminho)).toEqual(["/api/v0/cart", "/api/v0/checkout"])
    expect(chamadas[1].corpo).toEqual({ orders: ["abc123"] })
    expect(resultado).toEqual({
      ok: true,
      id: "abc123",
      precoCentavos: 3427,
      situacao: "released",
    })
  })

  it("devolve o id quando o pagamento falha, para não criar segunda etiqueta", async () => {
    const erro: any = new Error("SuperFrete: saldo insuficiente")
    erro.status = 400

    const resultado = await emitirEtiqueta({
      pedido,
      caixa,
      config,
      chamar: responder({
        "/api/v0/cart": { id: "abc123", price: 34.27 },
        "/api/v0/checkout": erro,
      }),
    })

    expect(resultado.ok).toBe(false)
    expect((resultado as any).id).toBe("abc123")
    expect((resultado as any).mensagem).toContain("saldo")
  })

  it("não paga quando a criação falha", async () => {
    const erro: any = new Error("SuperFrete: CEP inválido")
    erro.status = 400

    const resultado = await emitirEtiqueta({
      pedido,
      caixa,
      config,
      chamar: responder({ "/api/v0/cart": erro }),
    })

    expect(resultado.ok).toBe(false)
    expect(chamadas).toHaveLength(1)
  })

  it("recusa resposta sem id em vez de pagar um pedido vazio", async () => {
    const resultado = await emitirEtiqueta({
      pedido,
      caixa,
      config,
      chamar: responder({ "/api/v0/cart": { price: 10 }, "/api/v0/checkout": {} }),
    })

    expect(resultado.ok).toBe(false)
    expect(chamadas).toHaveLength(1)
  })

describe("cancelar, imprimir e saldo", () => {
  it("cancela com motivo, e o motivo padrão existe", async () => {
    let enviado: any

    const resultado = await cancelarEtiqueta({
      id: "abc123",
      motivo: "",
      config,
      chamar: (async (args: any) => {
        enviado = args.corpo
        return {}
      }) as Chamar,
    })

    expect(resultado.ok).toBe(true)
    expect(enviado.order.id).toBe("abc123")
    expect(enviado.order.description).toBe("Cancelado pelo lojista")
  })

  it("repassa o erro de etiqueta já postada", async () => {
    const erro: any = new Error("SuperFrete: não é possível cancelar")
    erro.status = 400

    const resultado = await cancelarEtiqueta({
      id: "abc123",
      motivo: "teste",
      config,
      chamar: (async () => {
        throw erro
      }) as Chamar,
    })

    expect(resultado.ok).toBe(false)
    expect((resultado as any).status).toBe(400)
  })

  it("devolve o link do PDF", async () => {
    const resultado = await urlDaEtiqueta({
      id: "abc123",
      config,
      chamar: (async () => ({
        url: "https://sandbox.superfrete.com/_etiqueta/pdf/x",
      })) as Chamar,
    })

    expect(resultado).toEqual({
      ok: true,
      url: "https://sandbox.superfrete.com/_etiqueta/pdf/x",
    })
  })

  it("recusa link vazio em vez de mandar o navegador para lugar nenhum", async () => {
    const resultado = await urlDaEtiqueta({
      id: "abc123",
      config,
      chamar: (async () => ({})) as Chamar,
    })

    expect(resultado.ok).toBe(false)
  })

  it("converte o saldo em centavos", async () => {
    const resultado = await saldoDaCarteira({
      config,
      chamar: (async () => ({ balance: 1763.04 })) as Chamar,
    })

    expect(resultado).toEqual({ ok: true, saldoCentavos: 176304 })
  })

  it("falha de saldo é falha, não saldo zero", async () => {
    const resultado = await saldoDaCarteira({
      config,
      chamar: (async () => {
        throw new Error("SuperFrete respondeu 502.")
      }) as Chamar,
    })

    expect(resultado.ok).toBe(false)
  })
})

describe("linkDeRastreio e situações", () => {
  it("aponta para o rastreio da SuperFrete com o id da etiqueta", () => {
    expect(linkDeRastreio("abc123")).toBe(
      "https://rastreio.superfrete.com/#/tracking/abc123"
    )
  })

  it("traduz os status da API para o que o lojista lê", () => {
    expect(situacaoDaEtiqueta("pending")).toBe("Aguardando pagamento")
    expect(situacaoDaEtiqueta("released")).toBe("Aguardando postagem")
    expect(situacaoDaEtiqueta("posted")).toBe("Postada")
  })

  it("não inventa tradução para status desconhecido", () => {
    expect(situacaoDaEtiqueta("???")).toBe("Situação desconhecida")
  })
})


describe("leitura do pedido", () => {
  it("separa rua, número e complemento do address_1 do Medusa", () => {
    expect(separarRua("Rua das Flores, 123 - apto 4")).toEqual({
      rua: "Rua das Flores",
      numero: "123",
      complemento: "apto 4",
    })
  })

  it("aceita número com letra", () => {
    expect(separarRua("Rua B 45A")).toEqual({
      rua: "Rua B",
      numero: "45A",
      complemento: "",
    })
  })

  it("deixa o número vazio quando a cliente não digitou", () => {
    expect(separarRua("Rua das Flores")).toEqual({
      rua: "Rua das Flores",
      numero: "",
      complemento: "",
    })
  })

  it("lê o CPF do metadata — o F0 é quem o grava", () => {
    expect(cpfDoPedido({ cpf: "12345678901" })).toBe("12345678901")
    expect(cpfDoPedido(undefined)).toBe("")
  })

  it("monta o destinatário a partir do endereço de entrega", () => {
    const d = destinatarioDoPedido(
      {
        email: "maria@exemplo.com",
        shipping_address: {
          first_name: "Maria",
          last_name: "Silva",
          address_1: "Rua da Assembleia, 10",
          city: "Rio de Janeiro",
          province: "RJ",
          postal_code: "20040-020",
          phone: "21988887777",
        },
      },
      { cpf: "12345678901" }
    )

    expect(d.nome).toBe("Maria Silva")
    expect(d.numero).toBe("10")
    expect(d.estado).toBe("RJ")
    expect(d.documento).toBe("12345678901")
  })

  /** O bairro saía do `province` (a UF); os dois vêm do metadata do endereço (RV-041). */
  it("lê número e bairro do metadata do endereço, não da UF", () => {
    const d = destinatarioDoPedido(
      {
        shipping_address: {
          first_name: "Maria",
          address_1: "Avenida Paulista",
          city: "São Paulo",
          province: "SP",
          postal_code: "01310-100",
          metadata: { numero: "1578", bairro: "Bela Vista" },
        },
      },
      {}
    )

    expect(d.numero).toBe("1578")
    expect(d.bairro).toBe("Bela Vista")
    expect(d.estado).toBe("SP")
  })

  it("sem o metadata, o bairro fica vazio em vez de virar a UF", () => {
    const d = destinatarioDoPedido(
      {
        shipping_address: {
          address_1: "Avenida Paulista",
          city: "São Paulo",
          province: "SP",
          postal_code: "01310-100",
        },
      },
      {}
    )

    // Vazio barra a etiqueta com a mensagem do que falta; "SP" no bairro printava errado.
    expect(d.bairro).toBe("")
  })

  it("o complemento digitado não vira número", () => {
    const d = destinatarioDoPedido(
      {
        shipping_address: {
          address_1: "Rua A",
          address_2: "Apto 42",
          city: "Campinas",
          province: "SP",
          postal_code: "13010-000",
        },
      },
      {}
    )

    expect(d.numero).toBe("")
    expect(d.complemento).toBe("Apto 42")
  })

  it("pedido antigo, com o número no address_2, continua saindo com número", () => {
    const d = destinatarioDoPedido(
      {
        shipping_address: {
          address_1: "Rua A",
          address_2: "123",
          city: "Campinas",
          province: "SP",
          postal_code: "13010-000",
        },
      },
      {}
    )

    expect(d.numero).toBe("123")
    expect(d.complemento).toBe("")
  })

  it("o remetente prefere o bairro do metadata e só cai na UF quando ele não existe", () => {
    const comBairro = remetenteDoLocal({
      address: {
        address_1: "Rua B",
        city: "Campinas",
        province: "SP",
        postal_code: "13010-000",
        metadata: { bairro: "Centro" },
      },
    })

    expect(comBairro.bairro).toBe("Centro")

    // O local de estoque é configuração da operação: sem o dado, a UF é o que
    // existe — e é o que já saía. Diferente do destinatário, aqui não há
    // formulário para corrigir, e bairro vazio travaria toda etiqueta.
    const semBairro = remetenteDoLocal({
      address: { address_1: "Rua B", city: "Campinas", province: "SP" },
    })

    expect(semBairro.bairro).toBe("SP")
  })

  it("lê o serviço que o provider gravou na opção", () => {
    expect(servicoDaOpcao({ servico: "sedex" })).toBe("SEDEX")
    expect(servicoDaOpcao({})).toBeNull()
    expect(servicoDaOpcao({ servico: "JADLOG" })).toBe("JADLOG")
  })

  it("só considera pago o pedido capturado", () => {
    expect(pago("", "captured")).toBe(true)
    expect(pago("", "authorized")).toBe(false)
    expect(pago("", "")).toBe(false)
  })

  it("descarta item sem quantidade e converte o preço para centavos", () => {
    // `unit_price` é decimal no Medusa v2 (249.9 = R$ 249,90), não centavos.
    const produtos = produtosDoPedido([
      { product_title: "Kit", quantity: 1, unit_price: 129.9 },
      { product_title: "Vazio", quantity: 0, unit_price: 10 },
    ])

    expect(produtos).toEqual([{ nome: "Kit", quantidade: 1, valorCentavos: 12990 }])
  })
})

})
