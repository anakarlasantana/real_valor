/**
 * As variáveis do e-mail: nome, itens, total e links. Ausentes viram `""` (o
 * Resend recusa variável ausente sem fallback) e o HTML dos itens é escapado.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */

/** O pedido, no mínimo que o e-mail precisa. Compatível com `OrderDTO`. */
export type PedidoParaEmail = {
  id: string
  display_id?: number | null
  email?: string | null
  currency_code?: string | null
  total?: unknown
  items?: Array<{
    title?: string | null
    variant_title?: string | null
    quantity?: number | null
    unit_price?: unknown
    total?: unknown
  }> | null
  shipping_address?: {
    first_name?: string | null
    country_code?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
  } | null
  shipping_methods?: Array<{ name?: string | null }> | null
}

/** O HTML que o template insere em `{{{ITENS}}}`. */
export function escaparHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Um valor do Medusa (`BigNumberValue`) como número.
 *
 * Ele pode chegar como `number`, como string ou como o `BigNumber` do próprio
 * Medusa; `Number(String(valor))` cobre os três e devolve `0` em vez de `NaN`
 * quando não dá para ler.
 */
export function comoNumero(valor: unknown): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0
  }

  const numero = Number(String(valor ?? ""))
  return Number.isFinite(numero) ? numero : 0
}

/** `1234.5` + `brl` → `R$ 1.234,50`. */
export function formatarDinheiro(
  valor: unknown,
  moeda: string | null | undefined
): string {
  const numero = comoNumero(valor)
  const codigo = (moeda || "BRL").toUpperCase()

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: codigo,
    }).format(numero)
  } catch {
    // Moeda inválida não pode derrubar o e-mail: o número cru ainda informa.
    return `${codigo} ${numero.toFixed(2)}`
  }
}

/** O primeiro nome de quem comprou; "Cliente" quando o pedido não tem. */
export function primeiroNome(pedido: PedidoParaEmail): string {
  return String(pedido.shipping_address?.first_name ?? "").trim() || "Cliente"
}

/** O número que a cliente reconhece (`display_id`), não o id interno. */
export function numeroDoPedido(pedido: PedidoParaEmail): string {
  const numero = pedido.display_id
  return numero === null || numero === undefined ? "" : String(numero)
}


/**
 * A lista de itens em HTML, uma linha por item.
 *
 * `total` da linha quando existe; senão `unit_price × quantity`. O título e a
 * variante são escapados porque vêm do catálogo, que é editável no painel.
 */
export function itensEmHtml(pedido: PedidoParaEmail): string {
  const itens = pedido.items ?? []

  if (itens.length === 0) {
    return ""
  }

  const linhas = itens.map((item) => {
    const quantidade = Math.max(1, comoNumero(item.quantity))
    const titulo = escaparHtml(item.title || "Peça")
    const variante = item.variant_title
      ? ` <span style="color:#6b6b6b">(${escaparHtml(item.variant_title)})</span>`
      : ""
    const preco = formatarDinheiro(
      item.total ?? comoNumero(item.unit_price) * quantidade,
      pedido.currency_code
    )

    return `<li style="margin:0 0 6px">${quantidade}× ${titulo}${variante} — ${preco}</li>`
  })

  return `<ul style="margin:0;padding-left:18px">${linhas.join("")}</ul>`
}

/**
 * O link para a página de pedido confirmado no storefront.
 *
 * `STOREFRONT_URL` é a URL **pública** (o navegador da cliente), e não o
 * `FRONTEND_URL` interno da rede do Compose. Sem ela, devolve `""`: um link
 * para `http://frontend:8000` num e-mail não abre em lugar nenhum.
 */
export function linkDoPedido(
  pedido: PedidoParaEmail,
  storefrontUrl: string | null | undefined
): string {
  const base = String(storefrontUrl ?? "").trim().replace(/\/+$/, "")

  if (!base) {
    return ""
  }

  const pais = String(pedido.shipping_address?.country_code ?? "br")
    .trim()
    .toLowerCase()

  return `${base}/${pais}/order/${pedido.id}/confirmed`
}

/** As variáveis do template `pedido-confirmado`. */
export function dadosDoPedidoConfirmado(
  pedido: PedidoParaEmail,
  storefrontUrl?: string | null
): Record<string, string> {
  return {
    NOME: primeiroNome(pedido),
    PEDIDO: numeroDoPedido(pedido),
    ITENS: itensEmHtml(pedido),
    TOTAL: formatarDinheiro(pedido.total, pedido.currency_code),
    ENTREGA: String(pedido.shipping_methods?.[0]?.name ?? "").trim(),
    LINK: linkDoPedido(pedido, storefrontUrl),
  }
}

/** As variáveis do template `pedido-cancelado`. */
export function dadosDoPedidoCancelado(
  pedido: PedidoParaEmail,
  storefrontUrl?: string | null
): Record<string, string> {
  return {
    NOME: primeiroNome(pedido),
    PEDIDO: numeroDoPedido(pedido),
    LINK: linkDoPedido(pedido, storefrontUrl),
  }
}

/** O fato do envio, como o `metadata` do pedido o guarda. */
export type DadosDoEnvio = {
  carrier?: unknown
  tracking_number?: unknown
  tracking_url?: unknown
  status_label?: unknown
}

/**
 * As variáveis do template `pedido-enviado`.
 *
 * `SITUACAO` é o rótulo que o painel já mostra na página de rastreio, e é o
 * que dá sentido ao e-mail de "atualizado": sem ele, uma mudança de status
 * chegaria como uma frase vazia.
 */
export function dadosDoEnvio(
  pedido: PedidoParaEmail,
  metadata: Record<string, unknown> | null | undefined,
  storefrontUrl?: string | null
): Record<string, string> {
  const envio = (metadata ?? {}) as DadosDoEnvio

  return {
    NOME: primeiroNome(pedido),
    PEDIDO: numeroDoPedido(pedido),
    SITUACAO: String(envio.status_label ?? "").trim() || "Atualizado",
    TRANSPORTADORA: String(envio.carrier ?? "").trim(),
    RASTREIO: String(envio.tracking_number ?? "").trim(),
    LINK_RASTREIO: String(envio.tracking_url ?? "").trim(),
    LINK: linkDoPedido(pedido, storefrontUrl),
  }
}
