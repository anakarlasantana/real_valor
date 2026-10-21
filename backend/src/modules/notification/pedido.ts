/** Variáveis do e-mail: ausente vira `""`; itens escapados; duas famílias de nome. */

/** O pedido, no mínimo que o e-mail precisa. Compatível com `OrderDTO`. */
export type PedidoParaEmail = {
  id: string;
  display_id?: number | null;
  email?: string | null;
  currency_code?: string | null;
  /** `authorized`, `captured`, `awaiting`… — vira `STATUS_PAGAMENTO`. */
  payment_status?: string | null;
  /** ISO 8601; vira `dd/mm/aaaa` em `DATA_PEDIDO`. */
  created_at?: string | Date | null;
  total?: unknown;
  items?: Array<{
    title?: string | null;
    variant_title?: string | null;
    quantity?: number | null;
    unit_price?: unknown;
    total?: unknown;
  }> | null;
  shipping_address?: {
    first_name?: string | null;
    country_code?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
  } | null;
  shipping_methods?: Array<{ name?: string | null }> | null;
};

/** Atendimento do botão e do rodapé; `EMAIL_ATENDIMENTO` manda. */
const ATENDIMENTO_PADRAO = "atendimento@realvalor.com.br";

export function emailDeAtendimento(): string {
  return (
    String(process.env.EMAIL_ATENDIMENTO ?? "").trim() || ATENDIMENTO_PADRAO
  );
}

/** URL pública da logo (`EMAIL_LOGO_URL`); vazio = remova o `<img>` do template. */
export function logoUrl(): string {
  return String(process.env.EMAIL_LOGO_URL ?? "").trim();
}

export const PREVISAO_PADRAO = "A confirmar";
export const RASTREIO_PADRAO = "Consulte a transportadora";

export const MOTIVO_CANCELAMENTO_PADRAO = "Cancelamento solicitado";
export const REEMBOLSO_PADRAO =
  "Se o seu pagamento já foi aprovado, o valor será devolvido pelo mesmo meio de pagamento usado na compra. Não é preciso fazer nada — o prazo para o valor aparecer em sua conta ou fatura depende do banco ou da operadora do cartão.";

/** O HTML que o template insere em `{{{ITENS}}}` — e o escape do catálogo. */
export function escaparHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Um `BigNumberValue` como número; ilegível é `0`. */
export function comoNumero(valor: unknown): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const numero = Number(String(valor ?? ""));
  return Number.isFinite(numero) ? numero : 0;
}

/** `1234.5` + `brl` → `R$ 1.234,50`; moeda inválida ainda informa número e código. */
export function formatarDinheiro(
  valor: unknown,
  moeda: string | null | undefined,
): string {
  const numero = comoNumero(valor);
  const codigo = (moeda || "BRL").toUpperCase();

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: codigo,
    }).format(numero);
  } catch {
    return `${codigo} ${numero.toFixed(2)}`;
  }
}

/** O primeiro nome de quem comprou; "Cliente" quando o pedido não tem. */
export function primeiroNome(pedido: PedidoParaEmail): string {
  return String(pedido.shipping_address?.first_name ?? "").trim() || "Cliente";
}

export function numeroDoPedido(pedido: PedidoParaEmail): string {
  const numero = pedido.display_id;
  return numero === null || numero === undefined ? "" : String(numero);
}

/** Uma data como `dd/mm/aaaa` (São Paulo): ISO ou `Date`; ilegível vira `""`. */
export function dataBr(valor: unknown): string {
  if (!valor) {
    return "";
  }

  const data = valor instanceof Date ? valor : new Date(String(valor));

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

/** O `payment_status` como a cliente lê; desconhecido vai capitalizado. */
export function rotuloDoPagamento(status: string | null | undefined): string {
  const chave = String(status ?? "")
    .trim()
    .toLowerCase();

  const rotulos: Record<string, string> = {
    awaiting: "Aguardando confirmação",
    pending: "Aguardando confirmação",
    authorized: "Autorizado",
    partially_authorized: "Autorizado parcialmente",
    captured: "Aprovado",
    partially_captured: "Aprovado parcialmente",
    refunded: "Reembolsado",
    partially_refunded: "Reembolsado parcialmente",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    requires_action: "Aguardando ação do banco",
    failed: "Recusado",
  };

  if (!chave) {
    return "";
  }

  return rotulos[chave] ?? chave.charAt(0).toUpperCase() + chave.slice(1);
}

/** Itens em HTML: `total` da linha, senão `unit_price × quantity`, escapados. */
export function itensEmHtml(pedido: PedidoParaEmail): string {
  const itens = pedido.items ?? [];

  if (itens.length === 0) {
    return "";
  }

  const linhas = itens.map((item) => {
    const quantidade = Math.max(1, comoNumero(item.quantity));
    const titulo = escaparHtml(item.title || "Peça");
    const variante = item.variant_title
      ? ` <span style="color:#6b6b6b">(${escaparHtml(item.variant_title)})</span>`
      : "";
    const preco = formatarDinheiro(
      item.total ?? comoNumero(item.unit_price) * quantidade,
      pedido.currency_code,
    );

    return `<li style="margin:0 0 6px">${quantidade}× ${titulo}${variante} — ${preco}</li>`;
  });

  return `<ul style="margin:0;padding-left:18px">${linhas.join("")}</ul>`;
}

/** O link do pedido: `STOREFRONT_URL` é a URL pública; sem ela, `""`. */
export function linkDoPedido(
  pedido: PedidoParaEmail,
  storefrontUrl: string | null | undefined,
): string {
  const base = String(storefrontUrl ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!base) {
    return "";
  }

  const pais = String(pedido.shipping_address?.country_code ?? "br")
    .trim()
    .toLowerCase();

  return `${base}/${pais}/order/${pedido.id}/confirmed`;
}

/** O resumo em texto, uma linha por item; o Resend já escapa as chaves duplas. */
export function resumoItens(pedido: PedidoParaEmail, separador = "\n"): string {
  const itens = pedido.items ?? [];

  return itens
    .map((item) => {
      const quantidade = Math.max(1, comoNumero(item.quantity));
      const titulo = String(item.title ?? "").trim() || "Peça";
      const variante = String(item.variant_title ?? "").trim();
      const preco = formatarDinheiro(
        item.total ?? comoNumero(item.unit_price) * quantidade,
        pedido.currency_code,
      );

      return `${quantidade}× ${titulo}${variante ? ` (${variante})` : ""} — ${preco}`;
    })
    .join(separador);
}

/** As variáveis que os três templates compartilham. */
function dadosComuns(
  pedido: PedidoParaEmail,
  storefrontUrl?: string | null,
): Record<string, string> {
  const numero = numeroDoPedido(pedido);
  const link = linkDoPedido(pedido, storefrontUrl);

  return {
    LOGO_URL: logoUrl(),
    EMAIL_ATENDIMENTO: emailDeAtendimento(),
    NOME_CLIENTE: primeiroNome(pedido),
    NUMERO_PEDIDO: numero,
    LINK_PEDIDO: link,
    NOME: primeiroNome(pedido),
    PEDIDO: numero,
    LINK: link,
  };
}

/** As variáveis do template `pedido-confirmado`. */
export function dadosDoPedidoConfirmado(
  pedido: PedidoParaEmail,
  storefrontUrl?: string | null,
): Record<string, string> {
  return {
    ...dadosComuns(pedido, storefrontUrl),
    DATA_PEDIDO: dataBr(pedido.created_at),
    RESUMO_ITENS: resumoItens(pedido, " · "),
    VALOR_TOTAL: formatarDinheiro(pedido.total, pedido.currency_code),
    STATUS_PAGAMENTO: rotuloDoPagamento(pedido.payment_status),
    ITENS: itensEmHtml(pedido),
    TOTAL: formatarDinheiro(pedido.total, pedido.currency_code),
    ENTREGA: String(pedido.shipping_methods?.[0]?.name ?? "").trim(),
  };
}

/** As variáveis do template `pedido-cancelado`. */
export function dadosDoPedidoCancelado(
  pedido: PedidoParaEmail,
  storefrontUrl?: string | null,
  metadata?: Record<string, unknown> | null,
): Record<string, string> {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const dataDoCancelamento = dataBr(m.canceled_at) || dataBr(new Date());

  return {
    ...dadosComuns(pedido, storefrontUrl),
    DATA_CANCELAMENTO: dataDoCancelamento,
    MOTIVO_CANCELAMENTO:
      String(m.cancel_reason ?? "").trim() || MOTIVO_CANCELAMENTO_PADRAO,
    INFORMACAO_REEMBOLSO:
      String(m.refund_info ?? "").trim() || REEMBOLSO_PADRAO,
  };
}

/** O fato do envio, como o `metadata` do pedido o guarda. */
export type DadosDoEnvio = {
  carrier?: unknown;
  tracking_number?: unknown;
  tracking_url?: unknown;
  status_label?: unknown;
};

/** `pedido-enviado`: `SITUACAO` (o rótulo do painel) é o que dá sentido ao e-mail. */
export function dadosDoEnvio(
  pedido: PedidoParaEmail,
  metadata: Record<string, unknown> | null | undefined,
  storefrontUrl?: string | null,
): Record<string, string> {
  const envio = (metadata ?? {}) as DadosDoEnvio;
  const transportadora = String(envio.carrier ?? "").trim();
  const rastreio = String(envio.tracking_number ?? "").trim();

  return {
    ...dadosComuns(pedido, storefrontUrl),
    SITUACAO: String(envio.status_label ?? "").trim() || "Atualizado",
    TRANSPORTADORA: transportadora,
    // Família antiga: o texto do README usa estes nomes; sem código, o padrão.
    PREVISAO_ENTREGA: PREVISAO_PADRAO,
    CODIGO_RASTREIO: rastreio || RASTREIO_PADRAO,
    LINK_RASTREIO: String(envio.tracking_url ?? "").trim(),
    RASTREIO: rastreio,
  };
}
