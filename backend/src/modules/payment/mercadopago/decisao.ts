/**
 * A decisão do webhook no lado do provider: as cinco checagens, na ordem, e a
 * ação. **É aqui que um pedido pago pode nascer** — o contrato do método e o
 * porquê de cada checagem estão no README do módulo.
 */
import { PaymentActions } from "@medusajs/framework/utils"
import type {
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/types"

import {
  HEADER_ASSINATURA,
  HEADER_REQUISICAO,
  validarAssinatura,
} from "./assinatura"
import type { Registrador } from "./boot"
import { buscarPagamento } from "./cliente"
import type { ContextoVerificado } from "./contexto"
import { segredosDoWebhook, toleranciaSegundos } from "./credenciais"
import { header, idDoPagamento, tipoDoEvento } from "./notificacao"
import { emReais, type Metodo } from "./preferencia"
import { idMascarado } from "./redigir"
import { statusDoWebhook } from "./status"

/** O que a decisão precisa de fora: de quem é o evento e onde gritar. */
type Contexto = {
  metodo: Metodo
  meuId: string
  logger: Registrador
}

/**
 * As cinco checagens — assinatura, tipo de evento, provedor, valor e provider —
 * fecham todas para o mesmo lado, "não faço nada", e o corpo da notificação
 * contribui com **um** dado: o id do pagamento. Nada do que sai daqui veio dele.
 */
export async function decidirNotificacao(
  payload: ProviderWebhookPayload["payload"],
  { metodo, meuId, logger }: Contexto
): Promise<WebhookActionResult> {
  const corpo = (payload?.data ?? {}) as Record<string, unknown>
  const cabecalhos = payload?.headers ?? {}

  const veredito = validarAssinatura({
    headerAssinatura: header(cabecalhos, HEADER_ASSINATURA),
    requestId: header(cabecalhos, HEADER_REQUISICAO),
    dataId: idDoPagamento(corpo),
    segredos: segredosDoWebhook(),
    toleranciaSegundos: toleranciaSegundos(),
  })

  if (!veredito.ok) {
    // O motivo vai para o log e **nada** dele vai para a resposta: quem está
    // sondando não descobre qual das cinco checagens falhou.
    logger.warn(
      `[mercadopago/${metodo}] notificação recusada (${veredito.motivo})`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  const tipo = tipoDoEvento(corpo)

  // O contexto que **só a nossa rota** pode produzir: de qual sessão é o
  // pagamento, quanto ela vale e de qual provider ela é. É a barreira contra a
  // rota nativa do Medusa — que emite o mesmo evento **sem** ele e não valida
  // assinatura nenhuma (ver `contexto.ts`).
  const contexto = (payload as { rv?: ContextoVerificado })?.rv
  const id = idDoPagamento(corpo)

  if (!contexto?.session_id || !id) {
    logger.warn(
      `[mercadopago/${metodo}] evento sem contexto verificado — ` +
        `ignorado (a rota nativa não é uma porta de entrada válida)`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  if (String(contexto.provider_id) !== meuId) {
    // O evento é do outro meio (ou de outro provedor inteiro). Recusar aqui, e
    // não antes, é o que torna a checagem independente de quem chamou.
    logger.warn(
      `[mercadopago/${metodo}] evento da sessão ` +
        `${idMascarado(contexto.session_id)} é de outro provider — ignorado`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  if (tipo && tipo !== "payment") {
    logger.info(`[mercadopago/${metodo}] evento ignorado (tipo=${tipo})`)

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  const pagamento = await buscarPagamento(id)
  const referencia = String(pagamento?.external_reference ?? "")

  if (!referencia) {
    // Sem `external_reference` não há como ligar o pagamento a um carrinho —
    // e um pagamento que não se liga a carrinho nenhum não pode criar pedido.
    logger.warn(
      `[mercadopago/${metodo}] pagamento ${idMascarado(id)} sem external_reference`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  if (referencia !== String(contexto.session_id)) {
    // O pagamento que o provedor confirmou **não é** o da sessão que a rota
    // verificou. Isto é o cenário de reaproveitar a notificação de um
    // pagamento alheio: o id vem de um pagamento real (assinatura válida,
    // porque o provedor o assinou), mas o `external_reference` dele aponta
    // para outro carrinho. Sem esta linha, o corpo do atacante — que ele
    // controla — decidiria de quem é o pagamento.
    logger.error(
      `[mercadopago/${metodo}] DIVERGÊNCIA: o pagamento ${idMascarado(id)} ` +
        `aponta para ${idMascarado(referencia)} e o evento para ` +
        `${idMascarado(contexto.session_id)}. Nada será aplicado.`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  const centavosDoProvedor = Math.round(
    Number(pagamento?.transaction_amount) * 100
  )
  const centavosDaSessao = Math.round(Number(contexto.amount))

  if (
    !Number.isFinite(centavosDoProvedor) ||
    !Number.isFinite(centavosDaSessao) ||
    centavosDoProvedor !== centavosDaSessao
  ) {
    logger.error(
      `[mercadopago/${metodo}] VALOR DIVERGENTE no pagamento ` +
        `${idMascarado(id)}: provedor=${centavosDoProvedor} ` +
        `sessão=${centavosDaSessao}. O pagamento não será aplicado; confira ` +
        `manualmente no painel do Mercado Pago.`
    )

    return { action: PaymentActions.NOT_SUPPORTED }
  }

  return acaoDoStatus({
    pagamento,
    referencia,
    centavos: centavosDaSessao,
    metodo,
    logger,
  })
}

/** Traduz o status **já validado** na ação que o Medusa executa. */
function acaoDoStatus({
  pagamento,
  referencia,
  centavos,
  metodo,
  logger,
}: {
  metodo: Metodo
  logger: Registrador
  pagamento: Record<string, unknown>
  referencia: string
  centavos: number
}): WebhookActionResult {
  const status = String(pagamento?.status ?? "error")

  logger.info(
    `[mercadopago/${metodo}] ${idMascarado(pagamento?.id)} · ${status} · ` +
      `${emReais(centavos).toFixed(2)} BRL · sessão ${idMascarado(referencia)}`
  )

  switch (statusDoWebhook(status)) {
    case "approved":
      // `SUCCESSFUL` é o que faz o Medusa autorizar **e** capturar de uma vez.
      // É o certo para o Mercado Pago: sem `capture: false` na preferência, o
      // dinheiro já está capturado quando o status vira `approved`.
      return {
        action: PaymentActions.SUCCESSFUL,
        data: { session_id: referencia, amount: centavos },
      }

    case "pending":
      // **De propósito não faz nada.** Um `pending` do Pix é o instante em que
      // o QR foi gerado. Deixar isto completar o carrinho criaria um pedido
      // (com reserva de estoque) para cada Pix gerado **e abandonado** — que é
      // a maioria deles. O pedido nasce quando o dinheiro entra.
      return { action: PaymentActions.NOT_SUPPORTED }

    case "canceled":
      return {
        action: PaymentActions.FAILED,
        data: { session_id: referencia, amount: centavos },
      }

    default:
      // `refunded` e `charged_back` caem aqui. Estorno **não** é automatizado
      // neste provider: quem estorna é uma pessoa, no painel do Mercado Pago,
      // e o registro é manual. Automatizar devolveria dinheiro a partir de uma
      // notificação, e essa decisão não pertence a um webhook.
      logger.warn(
        `[mercadopago/${metodo}] status "${status}" não tratado — ` +
          `nenhuma ação tomada (${idMascarado(pagamento?.id)})`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
  }
}
