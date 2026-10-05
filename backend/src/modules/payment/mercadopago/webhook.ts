/**
 * O webhook do Mercado Pago — a única porta de entrada de dinheiro na loja.
 * -------------------------------------------------------------------------
 * **Tudo acontece aqui, e nada acontece sem passar por aqui.** Este arquivo é
 * o corpo da rota `POST /webhooks/mercadopago` (e do `/:metodo`). Ele faz cinco
 * coisas, nesta ordem:
 *
 * 1. **Confere a assinatura.** Sem isso, nada mais importa: o corpo é de quem
 *    enviou. Falha → **401 e nenhum efeito colateral** — nenhuma consulta, nenhum
 *    evento, nenhum log com dado de terceiro.
 * 2. **Pergunta ao provedor.** `GET /v1/payments/{id}` é a **fonte de verdade**:
 *    status e valor saem de lá, nunca do corpo.
 * 3. **Resolve a sessão.** O `external_reference` que escrevemos na preferência
 *    aponta para a payment session do Medusa — é o que liga o pagamento a um
 *    carrinho.
 * 4. **Confere o que o corpo não pode responder.** O valor do provedor tem de
 *    bater com o da sessão; a sessão tem de ser de um provider conhecido.
 * 5. **Emite o evento**, com o contexto apurado, para o provider decidir.
 *
 * **Por que a decisão fica no provider, e não aqui.** Este arquivo é o porteiro:
 * ele sabe sobre HTTP, assinatura e banco. O provider sabe sobre o Mercado Pago
 * e sobre o que é um pedido pago. Misturar os dois faria a regra de negócio
 * depender de uma rota — e uma regra que só existe numa rota é uma regra que
 * some quando alguém cria uma rota nova.
 *
 * **O que este arquivo deliberadamente NÃO faz: confiar em query string.**
 * A rota aceita `/pix` e `/cartao` no caminho, mas o método **de verdade** vem
 * da sessão gravada (o `provider_id`), e é comparado com o do caminho apenas
 * para registrar divergência. Quem controla a URL não controla a decisão.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  Modules,
  PaymentWebhookEvents,
} from "@medusajs/framework/utils"

import {
  HEADER_ASSINATURA,
  HEADER_REQUISICAO,
  validarAssinatura,
} from "./assinatura"
import { buscarPagamento } from "./cliente"
import {
  CHAVE_CONTEXTO,
  nomeDoProviderNoEvento,
  type ContextoVerificado,
} from "./contexto"
import { segredosDoWebhook, toleranciaSegundos } from "./credenciais"
import { metodoDoProviderId, type Metodo } from "./preferencia"
import { idMascarado } from "./redigir"

/** A sessão de pagamento, como o módulo a devolve. */
type SessaoDePagamento = {
  id?: string
  provider_id?: string
  amount?: unknown
  currency_code?: string
  data?: Record<string, unknown>
}

/** O serviço de pagamento, do escopo da requisição. */
type ServicoDePagamento = {
  retrievePaymentSession: (id: string) => Promise<SessaoDePagamento>
  updatePaymentSession: (
    entrada: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
}

/**
 * Um cabeçalho, sem depender de o servidor ter baixado o nome para minúsculas.
 *
 * O Express entrega tudo em minúsculas, mas um proxy na frente pode não
 * entregar — e um `x-signature` que chega como `X-Signature` e não é lido
 * produz **401 em todo webhook**, com o segredo certo na mão e nenhuma pista.
 */
function cabecalho(req: MedusaRequest, nome: string): unknown {
  const cabecalhos = (req.headers ?? {}) as Record<string, unknown>

  if (cabecalhos[nome] !== undefined) {
    return cabecalhos[nome]
  }

  const chave = Object.keys(cabecalhos).find(
    (k) => k.toLowerCase() === nome.toLowerCase()
  )

  return chave === undefined ? undefined : cabecalhos[chave]
}

/** O id do pagamento, no corpo da notificação. Ver `idDoPagamento` em `service.ts`. */
function idDoPagamento(corpo: Record<string, unknown>): string {
  const interno = (corpo?.data ?? {}) as Record<string, unknown>
  const candidato = interno?.id ?? corpo?.id

  return candidato === undefined || candidato === null
    ? ""
    : String(candidato).trim()
}

/** Responde e encerra. Um lugar só para o formato da resposta. */
function responder(res: MedusaResponse, status: number, motivo?: string): void {
  // O corpo é **deliberadamente magro**: quem sonda recebe o suficiente para
  // saber que foi recusado, e nada que o ajude a ajustar a próxima tentativa.
  res
    .status(status)
    .json(motivo ? { recebido: false, erro: motivo } : { recebido: true })
}

/** Um logger, como o escopo da requisição entrega. */
type Logger = {
  info: (m: string) => void
  warn: (m: string) => void
  error: (m: string) => void
}

/**
 * O corpo da rota do webhook.
 *
 * `metodoNoCaminho` vem de `/webhooks/mercadopago/pix` e `/cartao`, e é
 * **apenas uma dica de log**: quem manda no método é o `provider_id` da sessão.
 * A versão sem sufixo (`/webhooks/mercadopago`) passa `undefined` e funciona
 * igual — ela existe para o caso de a URL cadastrada no painel do Mercado Pago
 * não ter o sufixo, que é o cenário mais provável na primeira configuração.
 */
export async function receberNotificacao(
  req: MedusaRequest,
  res: MedusaResponse,
  metodoNoCaminho?: Metodo
): Promise<void> {
  const logger = req.scope.resolve<Logger>("logger")

  const corpo = (req.body ?? {}) as Record<string, unknown>
  const id = idDoPagamento(corpo)

  // -------------------------------------------------------------------
  // 1. A assinatura. **O único portão que importa.**
  //
  // A resposta a uma assinatura ausente ou errada é 401 e **nada mais**: sem
  // consulta ao provedor, sem leitura de sessão, sem evento. É o que faz um
  // POST anônimo custar um HMAC e uma linha de log, em vez de uma consulta à
  // API do Mercado Pago por tentativa.
  //
  // **O corpo sem `data.id` é recusado aqui, e não tratado adiante.** O id é o
  // miolo do manifesto (`id:{data.id};…`): sem ele não há o que assinar, e
  // `validarAssinatura` devolve `sem_id` **antes** de calcular o HMAC — o
  // `motivo` do log já nomeia a causa. Havia aqui, logo abaixo deste portão, um
  // `if (!id)` inalcançável prometendo um 200 que o código não entregava: a
  // premissa dele é falsa, porque "evento que não é de pagamento" **chega com
  // id** — o próprio `test.created` do painel traz `data: { id: … }`.
  // -------------------------------------------------------------------
  const veredito = validarAssinatura({
    headerAssinatura: cabecalho(req, HEADER_ASSINATURA),
    requestId: cabecalho(req, HEADER_REQUISICAO),
    dataId: id,
    segredos: segredosDoWebhook(),
    toleranciaSegundos: toleranciaSegundos(),
  })

  if (!veredito.ok) {
    logger.warn(
      `[mercadopago/webhook] notificação recusada (${veredito.motivo})` +
        (id ? ` · pagamento ${idMascarado(id)}` : "")
    )

    responder(res, 401, "assinatura inválida")
    return
  }

  // -------------------------------------------------------------------
  // 2. O provedor confirma. **A fonte de verdade.**
  //
  // Uma falha aqui responde **500 de propósito**: significa que não foi possível
  // verificar, e o Mercado Pago reentrega notificações que falharam. Devolver
  // 200 diria "recebi, pode esquecer" para um pagamento que ainda não foi
  // aplicado — e o pedido nunca existiria, com o dinheiro recebido.
  // -------------------------------------------------------------------
  let pagamento: Record<string, unknown>

  try {
    pagamento = await buscarPagamento(id)
  } catch (e) {
    logger.error(
      `[mercadopago/webhook] não foi possível consultar o pagamento ` +
        `${idMascarado(id)}: ${(e as Error)?.message}`
    )

    responder(res, 500, "provedor indisponível")
    return
  }

  const status = String(pagamento?.status ?? "")
  const referencia = String(pagamento?.external_reference ?? "")

  if (!referencia) {
    // Pagamento de outra integração na mesma conta, ou criado fora da loja. Não
    // é erro nosso, e reentregar não ajudaria.
    logger.warn(
      `[mercadopago/webhook] pagamento ${idMascarado(id)} sem external_reference ` +
        `— não é desta loja`
    )

    responder(res, 200)
    return
  }

  const pagamentos = req.scope.resolve<ServicoDePagamento>(Modules.PAYMENT)

  // -------------------------------------------------------------------
  // 3. A sessão. É ela que liga o pagamento a um carrinho.
  // -------------------------------------------------------------------
  let sessao: SessaoDePagamento

  try {
    sessao = await pagamentos.retrievePaymentSession(referencia)
  } catch {
    // Um `external_reference` que aponta para lugar nenhum acontece de verdade:
    // é o pagamento de um carrinho que foi descartado. 200, e nada acontece.
    logger.warn(
      `[mercadopago/webhook] sessão ${idMascarado(referencia)} não existe ` +
        `(pagamento ${idMascarado(id)}) — nada a fazer`
    )

    responder(res, 200)
    return
  }

  // -------------------------------------------------------------------
  // 4. O que o corpo não pode responder.
  // -------------------------------------------------------------------
  const metodo = metodoDoProviderId(sessao.provider_id)

  if (!metodo) {
    logger.warn(
      `[mercadopago/webhook] a sessão ${idMascarado(referencia)} é do provider ` +
        `"${sessao.provider_id}", que não é do Mercado Pago — ignorada`
    )

    responder(res, 200)
    return
  }

  if (metodoNoCaminho && metodoNoCaminho !== metodo) {
    // Divergência entre a URL e a sessão. **Não é fatal, e é de propósito**: quem
    // decide é a sessão. Registrar serve para descobrir uma URL de notificação
    // mal configurada no painel antes de ela virar um problema.
    logger.warn(
      `[mercadopago/webhook] a URL diz "${metodoNoCaminho}" e a sessão diz ` +
        `"${metodo}" — vale a sessão`
    )
  }

  const centavosDoProvedor = Math.round(Number(pagamento?.transaction_amount) * 100)
  const centavosDaSessao = Math.round(Number(sessao.amount))

  if (
    !Number.isFinite(centavosDoProvedor) ||
    centavosDoProvedor !== centavosDaSessao
  ) {
    // ⚠️ A checagem que impede um pedido de mil reais ser pago com um real.
    // O valor pode divergir por erro de conciliação nosso (preço alterado
    // depois da sessão, taxa somada, cupom). Aplicar um valor que não bate cega
    // o financeiro — e por isso **nada é aplicado**, e o log pede conferência.
    logger.error(
      `[mercadopago/webhook] VALOR DIVERGENTE no pagamento ${idMascarado(id)}: ` +
        `provedor=${centavosDoProvedor} sessão=${centavosDaSessao}. ` +
        `Nada foi aplicado — confira manualmente no painel do Mercado Pago.`
    )

    responder(res, 200)
    return
  }

  const contexto: ContextoVerificado = {
    session_id: referencia,
    provider_id: String(sessao.provider_id),
    metodo,
    amount: centavosDaSessao,
    currency_code: String(sessao.currency_code ?? ""),
  }

  // -------------------------------------------------------------------
  // 5. Emite — e **só quando há o que decidir**.
  // -------------------------------------------------------------------
  if (status !== "approved") {
    // Qualquer status que não seja `approved` **não cria pedido**, e isso não é
    // uma aposta: o subscriber nativo do Medusa (`payment-webhook.js`) sai cedo
    // em `pending`, `canceled`, `failed`, `requires_more`, `pending_authorization`
    // e `not_supported`, e só `authorized`/`captured` chegam ao
    // `processPaymentWorkflow`.
    //
    // Emitir seria, então, uma consulta à API do Mercado Pago **por QR de Pix
    // gerado** — para o provider responder "não faço nada". Não emitimos; o
    // registro fica aqui, que é onde alguém vai procurar.
    //
    // Isto **não** afrouxa a segurança: o provider continua re-verificando tudo
    // no caminho que emite. O que muda é só quanto se gasta para dizer "nada a
    // fazer".
    logger.info(
      `[mercadopago/webhook] pagamento ${idMascarado(id)} está "${status}" — ` +
        `sem ação (só "approved" cria pedido)`
    )

    responder(res, 200)
    return
  }

  // O selo que `authorizePayment` exige, gravado **antes** de emitir: o
  // barramento local é imediato, e o selo precisa estar lá quando o evento
  // chegar.
  //
  // É `updatePaymentSession` e não uma escrita direta porque é a porta que o
  // módulo oferece — e ela passa pelo `updatePayment` do provider, que preserva
  // o `data`. O `amount` e o `currency_code` vão junto porque são
  // **obrigatórios** na atualização; passá-los com os valores atuais garante que
  // a operação não muda nada além do selo.
  try {
    await pagamentos.updatePaymentSession({
      id: referencia,
      amount: centavosDaSessao,
      currency_code: contexto.currency_code,
      data: {
        ...(sessao.data ?? {}),
        mp_confirmacao: {
          payment_id: id,
          status,
          amount: centavosDoProvedor,
          em: new Date().toISOString(),
        },
      },
    })
  } catch (e) {
    // Sem o selo, `authorizePayment` recusa e o pedido não nasce. Devolver
    // **500** é o certo: o Mercado Pago reentrega, e na reentrega o selo pode
    // ser gravado. Um 200 aqui perderia o pedido para sempre.
    logger.error(
      `[mercadopago/webhook] falha ao registrar a confirmação do pagamento ` +
        `${idMascarado(id)}: ${(e as Error)?.message}`
    )

    responder(res, 500, "falha ao registrar a confirmação")
    return
  }

  const eventBus = req.scope.resolve<{
    emit: (
      evento: { name: string; data: unknown },
      opcoes?: Record<string, unknown>
    ) => Promise<unknown>
  }>(Modules.EVENT_BUS)

  // Os mesmos defaults da rota nativa do Medusa (`webhook_delay` 5s,
  // `webhook_retries` 3). O atraso existe para não competir com a transação que
  // acabou de gravar o selo — e, aqui, também dá tempo de a resposta 200 chegar
  // ao Mercado Pago antes de o trabalho começar.
  const opcoes = (
    req.scope.resolve(Modules.PAYMENT) as
      | { options?: Record<string, unknown> }
      | undefined
  )?.options

  await eventBus.emit(
    {
      name: PaymentWebhookEvents.WebhookReceived,
      data: {
        // ⚠️ **Sem o prefixo `pp_`**: o módulo monta `` `pp_${provider}` ``.
        provider: nomeDoProviderNoEvento(metodo),
        payload: {
          data: corpo,
          rawData: req.rawBody,
          headers: req.headers,
          // O contexto verificado, ao lado do corpo e não dentro dele: o `data`
          // continua sendo exatamente o que o provedor mandou, e o que é nosso
          // fica identificável. Ver `contexto.ts`.
          [CHAVE_CONTEXTO]: contexto,
        },
      },
    },
    {
      delay: Number(opcoes?.webhook_delay ?? 5000),
      attempts: Number(opcoes?.webhook_retries ?? 3),
    }
  )

  logger.info(
    `[mercadopago/webhook] pagamento ${idMascarado(id)} aprovado · ` +
      `sessão ${idMascarado(referencia)} · evento emitido para "${metodo}"`
  )

  responder(res, 200)
}
