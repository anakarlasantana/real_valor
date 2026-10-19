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
  dataBr,
  escaparHtml,
  formatarDinheiro,
  itensEmHtml,
  linkDoPedido,
  numeroDoPedido,
  primeiroNome,
  rotuloDoPagamento,
} from "../pedido";

const texto = (valor: string) => valor.replace(/\u00a0/g, " ");

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
};

describe("escaparHtml", () => {
  it("neutraliza os cinco caracteres que mudam a marcação", () => {
    expect(escaparHtml(`<a href="x">O'Reilly & CIA</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#39;Reilly &amp; CIA&lt;/a&gt;",
    );
  });
});

describe("comoNumero", () => {
  it("aceita número, texto e nulo", () => {
    expect(comoNumero(12.5)).toBe(12.5);
    expect(comoNumero("12.5")).toBe(12.5);
    expect(comoNumero(null)).toBe(0);
    expect(comoNumero("não é número")).toBe(0);
  });
});

describe("formatarDinheiro", () => {
  it("escreve em reais como o Brasil escreve", () => {
    expect(texto(formatarDinheiro(1234.5, "brl"))).toBe("R$ 1.234,50");
  });

  it("não derruba o e-mail com moeda inválida", () => {
    expect(formatarDinheiro(10, "nao-existe")).toContain("10.00");
  });

  it("usa BRL quando o pedido não diz a moeda", () => {
    expect(texto(formatarDinheiro(10, null))).toContain("R$");
  });
});

describe("itensEmHtml", () => {
  it("monta uma linha por item, com quantidade, preço e variante", () => {
    const html = texto(itensEmHtml(pedido));

    expect(html).toContain("<ul");
    expect(html).toContain("2× Vestido Midi");
    expect(html).toContain("(M / Rosa)");
    expect(html).toContain("— R$ 259,90");
    expect(html).toContain("1× Cinto &lt;fino&gt;");
  });

  it("cai em unit_price × quantity quando a linha não tem total", () => {
    const html = texto(
      itensEmHtml({
        ...pedido,
        items: [{ title: "Peça", quantity: 3, unit_price: 10 }],
      }),
    );

    expect(html).toContain("3× Peça — R$ 30,00");
  });

  it("devolve vazio quando o pedido não tem itens", () => {
    expect(itensEmHtml({ ...pedido, items: [] })).toBe("");
    expect(itensEmHtml({ ...pedido, items: null })).toBe("");
  });
});

describe("linkDoPedido", () => {
  it("usa a URL pública e o país do endereço", () => {
    expect(linkDoPedido(pedido, "https://realvalor.com.br/")).toBe(
      "https://realvalor.com.br/br/order/order_123/confirmed",
    );
  });

  it("sem URL pública, não inventa um link interno", () => {
    expect(linkDoPedido(pedido, "")).toBe("");
    expect(linkDoPedido(pedido, null)).toBe("");
  });

  it("cai em br quando o pedido não tem país", () => {
    expect(
      linkDoPedido({ ...pedido, shipping_address: null }, "https://loja.com"),
    ).toBe("https://loja.com/br/order/order_123/confirmed");
  });
});

describe("dadosDoPedidoConfirmado", () => {
  it("entrega todas as variáveis do template, sem undefined", () => {
    const dados = dadosDoPedidoConfirmado(pedido, "https://realvalor.com.br");

    expect(dados.NOME).toBe("Ana");
    expect(dados.PEDIDO).toBe("1042");
    expect(texto(dados.TOTAL)).toBe("R$ 349,90");
    expect(dados.ENTREGA).toBe("PAC");
    expect(dados.ITENS).toContain("Vestido Midi");
    expect(dados.LINK).toContain("/br/order/order_123/confirmed");
    expect(Object.values(dados).every((v) => typeof v === "string")).toBe(true);
  });

  it("não deixa undefined quando o pedido está incompleto", () => {
    const dados = dadosDoPedidoConfirmado({ id: "order_1" });

    expect({
      ...dados,
      TOTAL: texto(dados.TOTAL),
      VALOR_TOTAL: texto(dados.VALOR_TOTAL),
    }).toMatchObject({
      NOME: "Cliente",
      PEDIDO: "",
      ITENS: "",
      TOTAL: "R$ 0,00",
      ENTREGA: "",
      LINK: "",
      NOME_CLIENTE: "Cliente",
      NUMERO_PEDIDO: "",
      LINK_PEDIDO: "",
      RESUMO_ITENS: "",
      VALOR_TOTAL: "R$ 0,00",
      DATA_PEDIDO: "",
      STATUS_PAGAMENTO: "",
      EMAIL_ATENDIMENTO: "atendimento@realvalor.com.br",
    });
    expect(Object.values(dados).every((v) => typeof v === "string")).toBe(true);
  });

  it("manda as variáveis do template publicado, junto das antigas", () => {
    const dados = dadosDoPedidoConfirmado(
      {
        ...pedido,
        payment_status: "captured",
        created_at: "2026-10-19T13:45:00.000Z",
      },
      "https://realvalor.com.br",
    );

    expect(
      Object.fromEntries(
        Object.entries(dados).map(([chave, valor]) => [chave, texto(valor)]),
      ),
    ).toMatchObject({
      NOME_CLIENTE: "Ana",
      NUMERO_PEDIDO: "1042",
      LINK_PEDIDO: "https://realvalor.com.br/br/order/order_123/confirmed",
      DATA_PEDIDO: "19/10/2026",
      STATUS_PAGAMENTO: "Aprovado",
      VALOR_TOTAL: "R$ 349,90",
      TOTAL: "R$ 349,90",
    });
    expect(texto(dados.RESUMO_ITENS)).toBe(
      "2× Vestido Midi (M / Rosa) — R$ 259,90 · 1× Cinto <fino> — R$ 90,00",
    );
  });

  it("liga LOGO_URL ao EMAIL_LOGO_URL do ambiente", () => {
    const antes = process.env.EMAIL_LOGO_URL;

    process.env.EMAIL_LOGO_URL = "https://realvalor.com.br/logo.png";

    try {
      expect(dadosDoPedidoConfirmado(pedido).LOGO_URL).toBe(
        "https://realvalor.com.br/logo.png",
      );
    } finally {
      if (antes === undefined) {
        delete process.env.EMAIL_LOGO_URL;
      } else {
        process.env.EMAIL_LOGO_URL = antes;
      }
    }
  });

  it("usa o endereço de atendimento do ambiente quando existe", () => {
    const antes = process.env.EMAIL_ATENDIMENTO;

    process.env.EMAIL_ATENDIMENTO = "sac@realvalor.com.br";

    try {
      expect(dadosDoPedidoConfirmado(pedido).EMAIL_ATENDIMENTO).toBe(
        "sac@realvalor.com.br",
      );
    } finally {
      if (antes === undefined) {
        delete process.env.EMAIL_ATENDIMENTO;
      } else {
        process.env.EMAIL_ATENDIMENTO = antes;
      }
    }
  });
});

describe("dadosDoPedidoCancelado", () => {
  it("manda nome, número e link — nada de item", () => {
    expect(
      dadosDoPedidoCancelado(pedido, "https://realvalor.com.br"),
    ).toMatchObject({
      NOME: "Ana",
      PEDIDO: "1042",
      LINK: "https://realvalor.com.br/br/order/order_123/confirmed",
      NOME_CLIENTE: "Ana",
      NUMERO_PEDIDO: "1042",
      LINK_PEDIDO: "https://realvalor.com.br/br/order/order_123/confirmed",
    });
  });

  it("data o cancelamento com o metadata, quando ele registra a data", () => {
    const dados = dadosDoPedidoCancelado(pedido, null, {
      canceled_at: "2026-10-20T02:00:00.000Z",
    });

    expect(dados.DATA_CANCELAMENTO).toBe("19/10/2026");
  });

  it("sem metadata, data o cancelamento com o instante do evento", () => {
    const dados = dadosDoPedidoCancelado(pedido);

    expect(dados.DATA_CANCELAMENTO).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("não inventa motivo nem prazo de reembolso", () => {
    const dados = dadosDoPedidoCancelado(pedido);

    expect(dados.MOTIVO_CANCELAMENTO).toBe("Cancelamento solicitado");
    expect(dados.INFORMACAO_REEMBOLSO).toContain("mesmo meio de pagamento");
    expect(dados.INFORMACAO_REEMBOLSO).toContain("depende do banco");
    expect(dados.INFORMACAO_REEMBOLSO).not.toMatch(/\d+\s*dias/);
  });

  it("prefere o motivo e o reembolso gravados no metadata", () => {
    const dados = dadosDoPedidoCancelado(pedido, null, {
      cancel_reason: "Cliente desistiu da compra",
      refund_info: "Estorno feito no cartão em 19/10/2026.",
    });

    expect(dados.MOTIVO_CANCELAMENTO).toBe("Cliente desistiu da compra");
    expect(dados.INFORMACAO_REEMBOLSO).toBe(
      "Estorno feito no cartão em 19/10/2026.",
    );
  });
});

describe("dadosDoEnvio", () => {
  it("lê o registro de envio e usa 'Atualizado' quando não há situação", () => {
    const dados = dadosDoEnvio(pedido, {
      carrier: "Correios",
      tracking_number: " BR123456789BR ",
      tracking_url: "https://rastreio/BR123456789BR",
      status_label: "",
    });

    expect(dados).toMatchObject({
      NOME: "Ana",
      PEDIDO: "1042",
      SITUACAO: "Atualizado",
      TRANSPORTADORA: "Correios",
      RASTREIO: "BR123456789BR",
      LINK_RASTREIO: "https://rastreio/BR123456789BR",
    });
  });

  it("usa o rótulo do rastreio quando existe", () => {
    const dados = dadosDoEnvio(pedido, { status_label: "Postada" });
    expect(dados.SITUACAO).toBe("Postada");
  });

  it("manda as variáveis do template publicado", () => {
    const dados = dadosDoEnvio(
      pedido,
      {
        carrier: "Correios",
        tracking_number: "BR123456789BR",
        tracking_url: "https://rastreio/BR123456789BR",
        status_label: "Em trânsito",
      },
      "https://realvalor.com.br",
    );

    expect(dados).toMatchObject({
      NOME_CLIENTE: "Ana",
      NUMERO_PEDIDO: "1042",
      LINK_PEDIDO: "https://realvalor.com.br/br/order/order_123/confirmed",
      SITUACAO: "Em trânsito",
      TRANSPORTADORA: "Correios",
      CODIGO_RASTREIO: "BR123456789BR",
      LINK_RASTREIO: "https://rastreio/BR123456789BR",
      RASTREIO: "BR123456789BR",
    });
  });

  it("não inventa prazo de entrega", () => {
    expect(dadosDoEnvio(pedido, {}).PREVISAO_ENTREGA).toBe("A confirmar");
  });

  it("sem código, manda o recado no lugar do rastreio vazio", () => {
    const dados = dadosDoEnvio(pedido, { carrier: "Correios" });

    expect(dados.CODIGO_RASTREIO).toBe("Consulte a transportadora");
    expect(dados.RASTREIO).toBe("");
    expect(dados.LINK_RASTREIO).toBe("");
  });
});

describe("dataBr", () => {
  it("escreve dd/mm/aaaa no fuso de São Paulo", () => {
    expect(dataBr("2026-10-20T02:00:00.000Z")).toBe("19/10/2026");
    expect(dataBr(new Date("2026-01-05T15:00:00.000Z"))).toBe("05/01/2026");
  });

  it("devolve vazio em vez de Invalid Date", () => {
    expect(dataBr(null)).toBe("");
    expect(dataBr(undefined)).toBe("");
    expect(dataBr("")).toBe("");
    expect(dataBr("não é data")).toBe("");
  });
});

describe("rotuloDoPagamento", () => {
  it("traduz os status que o Medusa usa", () => {
    expect(rotuloDoPagamento("captured")).toBe("Aprovado");
    expect(rotuloDoPagamento("authorized")).toBe("Autorizado");
    expect(rotuloDoPagamento("awaiting")).toBe("Aguardando confirmação");
    expect(rotuloDoPagamento("pending")).toBe("Aguardando confirmação");
    expect(rotuloDoPagamento("refunded")).toBe("Reembolsado");
    expect(rotuloDoPagamento("canceled")).toBe("Cancelado");
  });

  it("não inventa tradução para status desconhecido", () => {
    expect(rotuloDoPagamento("em_analise")).toBe("Em_analise");
    expect(rotuloDoPagamento(null)).toBe("");
    expect(rotuloDoPagamento(" ")).toBe("");
  });
});

describe("nome e número", () => {
  it("usa Cliente quando o endereço não tem nome", () => {
    expect(primeiroNome({ id: "order_1" })).toBe("Cliente");
    expect(
      primeiroNome({ id: "order_1", shipping_address: { first_name: " " } }),
    ).toBe("Cliente");
  });

  it("usa o display_id, e não o id interno", () => {
    expect(numeroDoPedido(pedido)).toBe("1042");
    expect(numeroDoPedido({ id: "order_1", display_id: null })).toBe("");
  });
});
