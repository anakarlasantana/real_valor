/**
 * O registro de envio de um pedido.
 * -------------------------------------------------------------------------
 * **A lacuna que este arquivo fecha.** `GET /store/orders/track` lê
 * `order.metadata.tracking_number`, `.tracking_url`, `.carrier` e
 * `.status_label` — mas **nada no backend escreve nesses campos**. A rota
 * existe e está bem feita (aceita nº do pedido + CPF **ou** e-mail, valida a
 * identidade com 403); o que falta é quem alimenta os dados. Sem isso, a
 * cliente consulta o rastreio e vê sempre `null`.
 *
 * Por que a regra mora aqui, e não na rota: a rota tem I/O (lê o pedido, grava,
 * responde). A parte que precisa de teste — normalizar o texto que o lojista
 * digitou, montar o link quando ele não vem, rejeitar o que não é código — é
 * função pura, e não se testa pelo meio da API.
 *
 * **Modelo genérico de propósito.** `carrier`, `tracking_number` e
 * `tracking_url` são TEXTO LIVRE, e não uma lista de transportadoras: o
 * provedor de frete ainda não foi decidido, e modelar o painel para a
 * transportadora de hoje obrigaria a refatorar quando a de amanhã for escolhida.
 * É a regra que mantém o RV-046 (adapter de transportadora) sem retrabalho.
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

/**
 * Os padrões de link das transportadoras brasileiras.
 *
 * Usados **só quando o lojista não digita a URL** — o campo continua sendo
 * texto livre, e um transportador novo não precisa entrar aqui: basta digitar
 * a URL. Estes são o atalho, não a regra.
 */
const CARRIER_URL_PATTERNS: Array<{
  match: RegExp
  url: (code: string) => string
}> = [
  {
    // Correios: BR123456789BR
    match: /^[A-Z]{2}\d{9,10}BR$/i,
    url: (code) =>
      `https://rastreios.correios.com.br/app/instalamento/app?codigo=${code}`,
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

/** O que a tela precisa saber para mostrar a situação do pedido. */
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
