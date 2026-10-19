/**
 * As variáveis do e-mail: escape de HTML, itens, dinheiro e links (nunca
 * `undefined`; sem `STOREFRONT_URL`, link vazio).
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
import {
  comoNumero,
  dadosDoEnvio,
  dadosDoPedidoCancelado,
  dadosDoPedidoConfirmado,
  escaparHtml,
  formatarDinheiro,
  itensEmHtml,
  linkDoPedido,
  numeroDoPedido,
  primeiroNome,
} from "../pedido"

const texto = (valor: string) => valor.replace(/\u00a0/g, " ")

const pedido = {
  id: "order_123",
  display_id: 1042,
  email: "ana@exemplo.com",
  currency_code: "brl",
  total: 349.9,
  items: [
    {
      title: "Vestido Midi",
      variant_title: "M / Rosa",
      quantity: 2,
      unit_price: 129.95,
      total: 259.9,
    },
    { title: "Cinto <fino>", quantity: 1, unit_price: 90 },
  ],
  shipping_address: {
    first_name: "Ana",
    country_code: "BR",
  },
  shipping_methods: [{ name: "PAC" }],
}

describe("escaparHtml", () => {
  it("neutraliza os cinco caracteres que mudam a marcação", () => {
    expect(escaparHtml(`<a href="x">O'Reilly & CIA</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#39;Reilly &amp; CIA&lt;/a&gt;"
    )
  })
})

describe("comoNumero", () => {
  it("aceita número, texto e nulo", () => {
    expect(comoNumero(12.5)).toBe(12.5)
    expect(comoNumero("12.5")).toBe(12.5)
    expect(comoNumero(null)).toBe(0)
    expect(comoNumero("não é número")).toBe(0)
  })
})

describe("formatarDinheiro", () => {
  it("escreve em reais como o Brasil escreve", () => {
    expect(texto(formatarDinheiro(1234.5, "brl"))).toBe("R$ 1.234,50")
  })

  it("não derruba o e-mail com moeda inválida", () => {
    expect(formatarDinheiro(10, "nao-existe")).toContain("10.00")
  })

  it("usa BRL quando o pedido não diz a moeda", () => {
    expect(texto(formatarDinheiro(10, null))).toContain("R$")
  })
})

describe("itensEmHtml", () => {
  it("monta uma linha por item, com quantidade, preço e variante", () => {
    const html = texto(itensEmHtml(pedido))

    expect(html).toContain("<ul")
    expect(html).toContain("2× Vestido Midi")
    expect(html).toContain("(M / Rosa)")
    expect(html).toContain("— R$ 259,90")
    expect(html).toContain("1× Cinto &lt;fino&gt;")
  })

  it("cai em unit_price × quantity quando a linha não tem total", () => {
    const html = texto(
      itensEmHtml({
        ...pedido,
        items: [{ title: "Peça", quantity: 3, unit_price: 10 }],
      })
    )

    expect(html).toContain("3× Peça — R$ 30,00")
  })

  it("devolve vazio quando o pedido não tem itens", () => {
    expect(itensEmHtml({ ...pedido, items: [] })).toBe("")
    expect(itensEmHtml({ ...pedido, items: null })).toBe("")
  })
})

describe("linkDoPedido", () => {
  it("usa a URL pública e o país do endereço", () => {
    expect(linkDoPedido(pedido, "https://realvalor.com.br/")).toBe(
      "https://realvalor.com.br/br/order/order_123/confirmed"
    )
  })

  it("sem URL pública, não inventa um link interno", () => {
    expect(linkDoPedido(pedido, "")).toBe("")
    expect(linkDoPedido(pedido, null)).toBe("")
  })

  it("cai em br quando o pedido não tem país", () => {
    expect(
      linkDoPedido({ ...pedido, shipping_address: null }, "https://loja.com")
    ).toBe("https://loja.com/br/order/order_123/confirmed")
  })
})

describe("dadosDoPedidoConfirmado", () => {
  it("entrega todas as variáveis do template, sem undefined", () => {
    const dados = dadosDoPedidoConfirmado(pedido, "https://realvalor.com.br")

    expect(dados.NOME).toBe("Ana")
    expect(dados.PEDIDO).toBe("1042")
    expect(texto(dados.TOTAL)).toBe("R$ 349,90")
    expect(dados.ENTREGA).toBe("PAC")
    expect(dados.ITENS).toContain("Vestido Midi")
    expect(dados.LINK).toContain("/br/order/order_123/confirmed")
    expect(Object.values(dados).every((v) => typeof v === "string")).toBe(true)
  })

  it("não deixa undefined quando o pedido está incompleto", () => {
    const dados = dadosDoPedidoConfirmado({ id: "order_1" })

    expect({ ...dados, TOTAL: texto(dados.TOTAL) }).toEqual({
      NOME: "Cliente",
      PEDIDO: "",
      ITENS: "",
      TOTAL: "R$ 0,00",
      ENTREGA: "",
      LINK: "",
    })
  })
})

describe("dadosDoPedidoCancelado", () => {
  it("manda nome, número e link — nada de item", () => {
    expect(dadosDoPedidoCancelado(pedido, "https://realvalor.com.br")).toEqual({
      NOME: "Ana",
      PEDIDO: "1042",
      LINK: "https://realvalor.com.br/br/order/order_123/confirmed",
    })
  })
})

describe("dadosDoEnvio", () => {
  it("lê o registro de envio e usa 'Atualizado' quando não há situação", () => {
    const dados = dadosDoEnvio(pedido, {
      carrier: "Correios",
      tracking_number: " BR123456789BR ",
      tracking_url: "https://rastreio/BR123456789BR",
      status_label: "",
    })

    expect(dados).toMatchObject({
      NOME: "Ana",
      PEDIDO: "1042",
      SITUACAO: "Atualizado",
      TRANSPORTADORA: "Correios",
      RASTREIO: "BR123456789BR",
      LINK_RASTREIO: "https://rastreio/BR123456789BR",
    })
  })

  it("usa o rótulo do rastreio quando existe", () => {
    const dados = dadosDoEnvio(pedido, { status_label: "Postada" })
    expect(dados.SITUACAO).toBe("Postada")
  })
})

describe("nome e número", () => {
  it("usa Cliente quando o endereço não tem nome", () => {
    expect(primeiroNome({ id: "order_1" })).toBe("Cliente")
    expect(
      primeiroNome({ id: "order_1", shipping_address: { first_name: " " } })
    ).toBe("Cliente")
  })

  it("usa o display_id, e não o id interno", () => {
    expect(numeroDoPedido(pedido)).toBe("1042")
    expect(numeroDoPedido({ id: "order_1", display_id: null })).toBe("")
  })
})
