/** O mapa fechado de status do provedor: a ação do webhook e o estado da sessão. */
import type { PaymentSessionStatus } from "@medusajs/types"

/** O que um evento do provedor significa para o webhook. Lista fechada. */
export type StatusDoWebhook = "approved" | "pending" | "canceled" | "nao_tratado"

/**
 * Como um status do provedor é lido pelo **webhook**.
 *
 * Separado de `statusDaSessao` porque as duas perguntas são diferentes: aqui é
 * "o que faço com este evento?", e lá é "que estado a sessão está?". Juntar as
 * duas num mapa só foi o que produziu `approved` como status de sessão — que
 * não existe — e teria passado despercebido até a primeira confirmação.
 *
 * A lista é **fechada**: um status que o provedor invente cai em
 * `nao_tratado`, e "não sei o que isto significa" é a resposta certa para um
 * pagamento — ao contrário de `pending`, que faria o checkout dizer
 * "aguardando" para sempre.
 */
export function statusDoWebhook(status: string): StatusDoWebhook {
  switch (status) {
    case "approved":
      return "approved"
    case "pending":
    case "in_process":
    case "authorized":
      return "pending"
    case "cancelled":
    case "rejected":
      return "canceled"
    default:
      return "nao_tratado"
  }
}

/**
 * Como um status do provedor é lido pela **sessão de pagamento** do Medusa.
 *
 * `approved` vira `captured` e não `authorized` de propósito: no Mercado Pago
 * (sem captura adiada) o dinheiro já entrou quando o status vira `approved`.
 * Dizer `authorized` faria o Medusa tratar como valor apenas reservado, e a
 * diferença aparece na conciliação — não no checkout.
 */
export function statusDaSessao(status: string): PaymentSessionStatus {
  switch (statusDoWebhook(status)) {
    case "approved":
      return "captured"
    case "pending":
      return "pending"
    case "canceled":
      return "canceled"
    default:
      return "error"
  }
}
