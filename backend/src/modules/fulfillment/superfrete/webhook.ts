/**
 * O webhook do SuperFrete: assinatura, evento e o que ele muda no pedido.
 * Regra pura — a rota e o subscriber fazem o I/O (§15.4.2 do doc 15).
 */

import { createHmac, timingSafeEqual } from "node:crypto"

import { situacaoDaEtiqueta } from "./etiqueta"

/** Onde o SuperFrete manda a assinatura: HMAC-SHA256 do corpo cru. */
export const HEADER_ASSINATURA = "x-me-signature"

/** O segredo vazio recusa tudo: sem chave, um HMAC não é conferência. */
export function assinaturaConfere(
  corpoCru: Buffer | string | undefined,
  recebida: unknown,
  segredo: string
): boolean {
  if (!segredo || !corpoCru) return false

  // A doc não fixa o prefixo `sha256=`; aceitar os dois custa uma linha.
  const assinatura = String(recebida ?? "").trim().toLowerCase().replace(/^sha256=/, "")

  if (!/^[0-9a-f]{64}$/.test(assinatura)) return false

  const esperada = createHmac("sha256", segredo).update(corpoCru).digest("hex")

  return timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))
}

export const EVENTOS_ASSINADOS = [
  "order.generated",
  "order.posted",
  "order.delivered",
  "order.cancelled",
] as const

export type EventoAssinado = (typeof EVENTOS_ASSINADOS)[number]

export function ehEventoAssinado(valor: unknown): valor is EventoAssinado {
  return EVENTOS_ASSINADOS.includes(String(valor ?? "").trim() as EventoAssinado)
}

export const SITUACAO_DO_EVENTO: Record<EventoAssinado, string> = {
  "order.generated": "released",
  "order.posted": "posted",
  "order.delivered": "delivered",
  "order.cancelled": "cancelled",
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : ""
}

export type EntregaDoAviso = {
  evento: EventoAssinado
  etiqueta: string
  situacao: string
  codigo: string
  urlDoRastreio: string
}

/** O que o aviso traz; `null` se não é um aviso que trate (o `id` é obrigatório). */
export function entregaDoAviso(corpo: unknown): EntregaDoAviso | null {
  const envelope = (corpo ?? {}) as Record<string, unknown>
  const evento = envelope.event

  if (!ehEventoAssinado(evento)) return null

  const dados = (envelope.data ?? {}) as Record<string, unknown>
  const etiqueta = texto(dados.id)

  if (!etiqueta) return null

  return {
    evento,
    etiqueta,
    situacao: SITUACAO_DO_EVENTO[evento],
    codigo: texto(dados.tracking),
    urlDoRastreio: texto(dados.tracking_url),
  }
}

/**
 * O `metadata` depois do aviso: `null` se não é desta etiqueta, se ela já foi
 * cancelada, ou se nada muda (a SuperFrete reentrega até 5 vezes).
 */
export function metadataDoAviso(
  aviso: EntregaDoAviso,
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  const antes = (metadata ?? {}) as Record<string, unknown>

  if (String(antes.superfrete_id ?? "").trim() !== aviso.etiqueta) return null
  if (String(antes.superfrete_cancelada ?? "").trim()) return null

  // O `generated` chega sem rastreio; apagar o link que o F2 gravou deixaria a
  // cliente sem para onde clicar.
  const codigo = aviso.codigo || String(antes.tracking_number ?? "").trim()
  const url = aviso.urlDoRastreio || String(antes.tracking_url ?? "").trim()

  const depois: Record<string, unknown> = {
    ...antes,
    superfrete_situacao: aviso.situacao,
    status_label: situacaoDaEtiqueta(aviso.situacao),
    ...(codigo ? { tracking_number: codigo } : {}),
    ...(url ? { tracking_url: url } : {}),
    ...(aviso.situacao === "cancelled" ? { superfrete_cancelada: aviso.etiqueta } : {}),
  }

  // `undefined` e `""` são o mesmo "não tem".
  const mudou = Object.keys(depois).some(
    (chave) => String(antes[chave] ?? "") !== String(depois[chave] ?? "")
  )

  return mudou ? depois : null
}
