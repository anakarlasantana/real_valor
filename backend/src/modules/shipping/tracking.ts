import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { enviarEmail, mascararEmail } from "../notification/enviar"
import {
  dadosDoEnvio,
  dadosDoPedidoCancelado,
  type PedidoParaEmail,
} from "../notification/pedido"
import {
  TEMPLATE_PEDIDO_CANCELADO,
  TEMPLATE_PEDIDO_ENVIADO,
} from "../notification/templates"

/**
 * O registro de envio de um pedido.
 *
 * A regra mora aqui, e não na rota, porque a rota tem I/O: a parte que precisa
 * de teste (normalizar o texto do lojista, deduzir o link, rejeitar o que não é
 * código) é função pura. `carrier`/`tracking_number`/`tracking_url` são TEXTO
 * LIVRE, não uma lista de transportadoras — é o que mantém o RV-046 sem
 * retrabalho quando outra transportadora entrar.
 */

/** O status padrão de um pedido que já foi pago e ainda não saiu. */
export const DEFAULT_STATUS_LABEL = "Em processamento"

/** O que o painel grava. Só o que mudou, para não reescrever o resto. */
export type ShippingUpdate = {
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  statusLabel?: string
}

/** O atalho para as transportadoras conhecidas; a URL digitada sempre vence. */
const CARRIER_URL_PATTERNS: Array<{
  match: RegExp
  url: (code: string) => string
}> = [
  {
    // Correios: BR123456789BR
    match: /^[A-Z]{2}\d{9,10}BR$/i,
    url: (code) => `https://rastreamento.correios.com.br/app/index.php?objetos=${code}`,
  },
  {
    // Jadlog/FedEx: 12-345678901234 (com ou sem hífen)
    match: /^\d{2}-?\d{10,14}$/,
    url: (code) =>
      `https://www.jadlog.com.br/jadlog/rastreamento?codigo=${code.replace(
        "-",
        ""
      )}`,
  },
  {
    // Totvs: 26 dígitos
    match: /^\d{26}$/,
    url: (code) =>
      `https://rastreamento.totalexpress.com.br/consulta?codigo=${code}`,
  },
]

/**
 * O link de consulta de um código, quando dá para deduzir pelo formato.
 *
 * Devolve `null` em vez de um link inventado quando o código não casa com
 * nenhum padrão: **um link errado leva a cliente a uma página de erro em
 * outro domínio**, e o melhor link do mundo é o que o lojista digitou.
 */
export function guessTrackingUrl(
  _carrier: string,
  code: string
): string | null {
  const limpo = code.trim().toUpperCase()

  for (const { match, url } of CARRIER_URL_PATTERNS) {
    if (match.test(limpo)) {
      return url(limpo)
    }
  }

  return null
}
/**
 * O que está errado num registro de envio. `null` quando está válido.
 *
 * A mensagem é o que o painel mostra, então ela é escrita para o lojista — e
 * diz o que fazer, não só o que está errado.
 */
export function validateShippingUpdate(
  update: ShippingUpdate
): string | null {
  const { carrier, trackingNumber, trackingUrl, statusLabel } = update

  if (trackingNumber !== undefined) {
    const codigo = trackingNumber.trim()

    if (codigo.length > 0 && codigo.length < 6) {
      return "O código de rastreio parece curto demais. Confira e digite de novo."
    }

    // Letras e dígitos, mais o hífen do formato do Jadlog. Qualquer outra coisa
    // (espaço no meio, barra, dois códigos colados) é quase sempre erro de
    // colagem — e um código errado manda a cliente para a transportadora errada.
    if (codigo.length > 0 && !/^[A-Za-z0-9-]+$/.test(codigo)) {
      return "O código de rastreio tem caracteres inválidos. Use apenas letras, números e hífen."
    }
  }

  if (trackingUrl !== undefined && trackingUrl.trim().length > 0) {
    if (!/^https?:\/\//i.test(trackingUrl.trim())) {
      return "O link precisa começar com http:// ou https://"
    }
  }

  // Um código sem transportadora não localiza nada: o link sai errado ou não
  // sai, e a cliente fica sem para onde clicar.
  if (
    trackingNumber !== undefined &&
    trackingNumber.trim().length > 0 &&
    (carrier === undefined || carrier.trim().length === 0)
  ) {
    return "Informe a transportadora junto com o código de rastreio."
  }

  if (carrier !== undefined && carrier.length > 80) {
    return "O nome da transportadora está longo demais (máximo de 80 caracteres)."
  }

  if (statusLabel !== undefined && statusLabel.length > 60) {
    return "A situação do pedido está longa demais (máximo de 60 caracteres)."
  }

  return null
}

/**
 * Os campos de `metadata` que este registro deve gravar.
 *
 * Devolve **só o que pertence ao envio** — o `metadata` do pedido guarda outras
 * coisas (o CPF que a rota de rastreio usa para validar a identidade), e
 * regravar o objeto inteiro apagaria o que não tem relação com envio.
 *
 * Sem código, devolve só o status padrão: é um pedido pago que ainda não saiu.
 */
export function buildShippingMetadata(
  anterior: Record<string, unknown> | null | undefined,
  update: ShippingUpdate
): Record<string, unknown> {
  const antes = (anterior ?? {}) as Record<string, unknown>

  const carrier =
    update.carrier !== undefined
      ? update.carrier.trim()
      : String(antes.carrier ?? "").trim()

  const codigo =
    update.trackingNumber !== undefined
      ? update.trackingNumber.trim()
      : String(antes.tracking_number ?? "").trim()

  const url =
    update.trackingUrl !== undefined
      ? update.trackingUrl.trim()
      : String(antes.tracking_url ?? "").trim()

  const status =
    update.statusLabel !== undefined
      ? update.statusLabel.trim()
      : String(antes.status_label ?? "").trim()

  return {
    carrier,
    tracking_number: codigo,
    // Link deduzido do formato do código só quando o lojista não digitou
    // nenhum — e só se o formato casar com um padrão conhecido.
    tracking_url: url || guessTrackingUrl(carrier, codigo) || "",
    status_label: status || DEFAULT_STATUS_LABEL,
  }
}

// O que a tela precisa saber para mostrar a situação do pedido.
export function shippingSummary(metadata: Record<string, unknown> | null): {
  enviado: boolean
  carrier: string
  trackingNumber: string
  trackingUrl: string
  statusLabel: string
} {
  const m = (metadata ?? {}) as Record<string, unknown>

  const codigo = String(m.tracking_number ?? "").trim()

  return {
    enviado: codigo.length > 0,
    carrier: String(m.carrier ?? "").trim(),
    trackingNumber: codigo,
    trackingUrl: String(m.tracking_url ?? "").trim(),
    statusLabel:
      String(m.status_label ?? "").trim() || DEFAULT_STATUS_LABEL,
  }
}

/** O que a cliente lê sobre o pedido, já decidido. */
export type SituacaoPublica = {
  rotulo: string
  cancelado: boolean
}

/**
 * O cancelamento vence o rótulo. O valor é o id da etiqueta, não booleano — daí
 * a leitura por presença (doc 15, §15.4.2).
 */
export function situacaoDoPedido(
  metadata: Record<string, unknown> | null | undefined
): SituacaoPublica {
  const m = (metadata ?? {}) as Record<string, unknown>

  if (String(m.superfrete_cancelada ?? "").trim()) {
    return { rotulo: "Cancelado", cancelado: true }
  }

  const rotulo = String(m.status_label ?? "").trim()

  return { rotulo: rotulo || DEFAULT_STATUS_LABEL, cancelado: false }
}

/** O JSON de `GET /store/orders/track`; o e-mail do pedido não sai. */
export function rastreioPublico(
  order: Record<string, any>,
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const m = (metadata ?? {}) as Record<string, unknown>
  const situacao = situacaoDoPedido(m)
  const endereco = order.shipping_address ?? {}

  return {
    order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
      created_at: order.created_at,
      total: order.total,
      currency_code: order.currency_code,
      shipping_address: {
        first_name: endereco.first_name ?? null,
        city: endereco.city ?? null,
        province: endereco.province ?? null,
        postal_code: endereco.postal_code ?? null,
      },
      items: (order.items ?? []).map((item: Record<string, any>) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        thumbnail: item.thumbnail,
      })),
      tracking: {
        tracking_number: String(m.tracking_number ?? "").trim() || null,
        tracking_url: String(m.tracking_url ?? "").trim() || null,
        carrier: String(m.carrier ?? "").trim() || null,
      },
      metadata: {
        order_status_label: situacao.rotulo,
        situacao: String(m.superfrete_situacao ?? "").trim() || null,
        cancelado: situacao.cancelado,
      },
    },
  }
}

/** O fato que merece um aviso à cliente. */
export type EventoDeAviso = "saiu" | "cancelado" | "atualizado"

export type PedidoParaAviso = PedidoParaEmail

/**
 * O ponto único de aviso à cliente (envio e cancelamento), com idempotência por
 * fato. Sem e-mail, avisa no log e volta. Ver doc 15, §15.10.
 */
export async function avisar(
  container: MedusaContainer,
  evento: EventoDeAviso,
  pedido: PedidoParaAviso,
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const m = (metadata ?? {}) as Record<string, unknown>
  const codigo = String(m.tracking_number ?? "").trim()
  const cancelado = evento === "cancelado"

  if (!String(pedido.email ?? "").trim()) {
    logger.warn(
      `[aviso] evento=${evento} pedido=${
        pedido.display_id ?? "?"
      }: sem e-mail de contato.`
    )
    return
  }

  const enviado = await enviarEmail(container, {
    to: pedido.email,
    template: cancelado ? TEMPLATE_PEDIDO_CANCELADO : TEMPLATE_PEDIDO_ENVIADO,
    data: cancelado
      ? dadosDoPedidoCancelado(pedido, process.env.STOREFRONT_URL, m)
      : dadosDoEnvio(pedido, m, process.env.STOREFRONT_URL),
    idempotencyKey: cancelado
      ? `order-canceled:${pedido.id}`
      : `order-shipped:${pedido.id}:${codigo}:${String(
          m.status_label ?? ""
        ).trim()}`,
    triggerType: "superfrete.entrega",
    resourceId: pedido.id,
  })

  if (enviado) {
    logger.info(
      `[aviso] evento=${evento} pedido=${
        pedido.display_id ?? "?"
      } codigo=${codigo || "-"} avisado em ${mascararEmail(pedido.email)}`
    )
  }
}

export function etiquetaDe(
  metadata: Record<string, unknown> | null
): { id: string; situacao: string; trackingUrl: string; preco: number } | null {
  const m = (metadata ?? {}) as Record<string, unknown>
  const id = String(m.superfrete_id ?? "").trim()

  if (!id) {
    return null
  }

  return {
    id,
    situacao: String(m.status_label ?? "").trim(),
    trackingUrl: String(m.tracking_url ?? "").trim(),
    preco: Number(m.superfrete_preco) || 0,
  }
}
