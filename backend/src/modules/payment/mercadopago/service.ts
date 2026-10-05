/**
 * O provider do Mercado Pago — a base que Pix e cartão compartilham.
 * -------------------------------------------------------------------------
 * **Por que um arquivo só para os dois.** Pix e cartão são o **mesmo**
 * provedor: a mesma conta, o mesmo token, a mesma API, o mesmo webhook. O que
 * muda é o documento da preferência (meios excluídos, parcelas). Duplicar o
 * provider seria duplicar quarenta linhas de fiação para divergirem na terceira
 * manutenção — e a divergência apareceria no comportamento, não no `git diff`.
 * A subclasse (`pix/`, `cartao/`) só diz **qual método ela é**.
 *
 * **Onde mora a verdade.** O corpo da notificação do Mercado Pago diz "houve
 * um evento no pagamento 123" e **nada mais** — nem valor, nem status, nem se
 * aquilo é real. Toda decisão deste arquivo sai de `GET /v1/payments/{id}`. A
 * distância entre as duas coisas é a diferença entre "alguém disse que pagou" e
 * "o provedor confirma que pagou", e é a única coisa que separa a loja de um
 * pedido de graça.
 *
 * **O que autoriza o pedido a existir.** Quem cria o pedido é o Medusa, no
 * `processPaymentWorkflow`, depois que este provider devolve
 * `PaymentActions.SUCCESSFUL`. Antes disso, o único freio entre "chegou um POST"
 * e "nasceu um pedido pago" é `getWebhookActionAndData` — assinatura conferida,
 * status buscado no provedor, valor conferido contra a sessão. Nenhuma dessas
 * três checagens é opcional, e nenhuma delas confia no corpo.
 *
 * **A idempotência não está aqui, e é de propósito.** Um webhook reentregue não
 * cria um pedido a mais: o Medusa protege as três coisas que ele faria —
 * `capturePayment_` sai cedo em `if (payment.captured_at)` (nada de cobrar
 * duas vezes), o passo de completar o carrinho é guardado por `!order` e o
 * autocapture por `!paymentData.length`. Guardar uma marca nossa para isso
 * seria uma segunda fonte de verdade para uma pergunta que o framework já
 * responde — e a segunda fonte é sempre a que fica desatualizada.
 */
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/types"

import {
  HEADER_ASSINATURA,
  HEADER_REQUISICAO,
  validarAssinatura,
} from "./assinatura"
import {
  buscarPagamento,
  buscarPorReferencia,
  criarPreferencia,
  pontoDeInicio,
} from "./cliente"
import type { ContextoVerificado } from "./contexto"
import {
  alertaDaNotificacao,
  descreverConfiguracao,
  divergenciaDeAmbiente,
  pagamentoDisponivel,
  segredosDoWebhook,
  toleranciaSegundos,
  urlDeNotificacao,
  urlsDeRetorno,
} from "./credenciais"
import {
  METODOS,
  construirPreferencia,
  emReais,
  type Metodo,
} from "./preferencia"
import { idMascarado, redigirPagamento, semPii } from "./redigir"

/** O que o Medusa injeta no provider. Só `logger` é usado. */
type Dependencias = {
  logger: {
    info: (m: string) => void
    warn: (m: string) => void
    error: (m: string) => void
  }
}

/** A descrição que aparece no checkout, quando o carrinho não manda a sua. */
const DESCRICAO_PADRAO = "Real Valor — pedido"

/** Lê um header sem depender de o servidor ter baixado o nome para minúsculas. */
function header(headers: Record<string, unknown>, nome: string): unknown {
  if (headers[nome] !== undefined) {
    return headers[nome]
  }

  const chave = Object.keys(headers).find(
    (k) => k.toLowerCase() === nome.toLowerCase()
  )

  return chave === undefined ? undefined : headers[chave]
}

/**
 * O id do pagamento, no corpo da notificação.
 *
 * **Duas camadas, e é fácil errar.** O corpo é
 * `{ type: "payment", action: "payment.updated", data: { id: 123 } }`, e o
 * Medusa entrega esse corpo inteiro dentro de `payload.data` — então o id está
 * em `payload.data.data.id`. O `?? payload.data.id` existe porque nem todo
 * evento do provedor aninha igual, e procurar nos dois lugares custa uma linha
 * contra uma tarde de "por que a notificação não faz nada?".
 */
function idDoPagamento(corpo: Record<string, unknown>): string | undefined {
  const interno = (corpo?.data ?? {}) as Record<string, unknown>
  const candidato = interno?.id ?? corpo?.id

  if (candidato === undefined || candidato === null || String(candidato).trim() === "") {
    return undefined
  }

  return String(candidato)
}

/** O `type` do evento, quando vem. `payment` é o único que nos interessa. */
function tipoDoEvento(corpo: Record<string, unknown>): string {
  return String(corpo?.type ?? corpo?.topic ?? "")
}

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
function statusDoWebhook(
  status: string
): "approved" | "pending" | "canceled" | "nao_tratado" {
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
function statusDaSessao(status: string): PaymentSessionStatus {
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

/**
 * A base dos dois providers do Mercado Pago.
 *
 * `metodo` é a **única** coisa que a subclasse precisa dizer. `identifier` é o
 * mesmo nos dois (`mercadopago`) porque é o nome do provedor; o que os separa é
 * o `id` da lista em `medusa-config.ts` — ver o comentário lá, e o
 * `registro.unit.spec.ts` que o prende.
 *
 * **`metodo` é `static`, e a razão é o construtor.** Um campo de instância só
 * existe **depois** do `super()`, e o construtor desta classe roda antes — o
 * log de boot leria `undefined` e escreveria `[mercadopago/undefined]`. Um
 * `static` está definido no momento em que o módulo carrega, e por isso é o
 * único lugar de onde o construtor pode ler com segurança.
 */
export abstract class MercadoPagoProvider extends AbstractPaymentProvider {
  static identifier = "mercadopago"

  /** Qual meio esta subclasse atende. Cada uma define o seu. */
  static metodo: Metodo

  /** O meio desta instância, lido da classe. */
  protected get metodo(): Metodo {
    return (this.constructor as typeof MercadoPagoProvider).metodo
  }

  protected logger_: Dependencias["logger"]

  constructor(container: Dependencias, options: Record<string, unknown>) {
    super(container as never, options)

    this.logger_ = container.logger

    // O log de boot é o único lugar onde se descobre que a variável não chegou
    // no container — e ele é **antes** de qualquer cliente tentar pagar. Só a
    // presença e a forma saem daqui: ver `descreverConfiguracao`.
    //
    // ⚠️ Até a correção do switch de ambiente esta chamada **não existia**.
    // `descreverConfiguracao` estava escrita e documentada desde o começo, e
    // nenhum código a chamava: o construtor escrevia só "pronto.", e um token de
    // conta de teste passava em silêncio. A promessa do comentário acima era
    // falsa, e foi assim que "produção" apareceu no log para um token que não
    // cobrava ninguém.
    const rotulo = `[mercadopago/${this.metodo}] ${METODOS[this.metodo].rotulo}`

    // Uma linha só, e não uma por variável: o boot já é barulhento, e o que se
    // faz com isto é `grep mercadopago` no log.
    this.logger_.info(
      `${rotulo} ${Object.entries(descreverConfiguracao())
        .map(([nome, valor]) => `${nome}=${valor}`)
        .join(" · ")}`
    )

    // A divergência vem **antes** do veredito, e no nível do desfecho: um erro
    // rebaixado a aviso seria lido como ruído, e este é o único lugar onde o
    // caso caro — a loja que abre e não vende — aparece em voz alta.
    const { erro, aviso } = divergenciaDeAmbiente()

    if (erro) {
      this.logger_.error(`${rotulo} CONFIGURAÇÃO RECUSADA — ${erro}`)
    } else if (aviso) {
      this.logger_.warn(`${rotulo} ${aviso}`)
    }

    // O alerta da URL de notificação é independente do veredito de pagamento, e
    // é a independência que o torna perigoso: o checkout funciona com ela errada.
    // Um endereço que não é o nosso não gera erro em lugar nenhum — nem no nosso
    // log, nem no painel do provedor, que registra a entrega como bem-sucedida —
    // e o pedido simplesmente não nasce. Ver `alertaDaNotificacao`.
    const alertaNotificacao = alertaDaNotificacao()

    if (alertaNotificacao) {
      this.logger_.warn(`${rotulo} ${alertaNotificacao}`)
    }

    const configuracao = pagamentoDisponivel()

    this.logger_.info(
      `${rotulo} ` +
        (configuracao.ok ? "pronto." : `INDISPONÍVEL — ${configuracao.motivo}`)
    )
  }

  /** O `provider_id` que o Medusa registra e o storefront resolve. */
  protected get meuId(): string {
    return METODOS[this.metodo].providerId
  }

  /**
   * Cria a preferência e devolve o endereço do checkout.
   *
   * **O `session_id` entra no `data` devolvido, e isso é obrigatório.** O Medusa
   * persiste este `data` na sessão, e é dele que `authorizePayment` e
   * `getPaymentStatus` leem o id da sessão depois — sem ele, nenhum dos dois tem
   * como saber **qual** carrinho aquela preferência cobra, e o pagamento
   * aprovado não acharia o pedido. `initiatePayment` é o único ponto em que a
   * sessão ainda é conhecida com certeza.
   *
   * **O valor sai daqui em centavos e viaja em reais.** A conversão é de
   * `construirPreferencia`, num lugar só, porque um erro de unidade aqui cobra
   * cem vezes o preço e o checkout continua funcionando.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const disponivel = pagamentoDisponivel()

    if (!disponivel.ok) {
      // Não é 500: é uma resposta explícita, com a mensagem que a cliente lê.
      // Um 500 num checkout sem credencial é um bug que parece instabilidade.
      throw new MedusaError(MedusaError.Types.INVALID_DATA, disponivel.motivo)
    }

    const sessionId = String((input.data?.session_id as string) ?? "")

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Não foi possível identificar o carrinho para iniciar o pagamento."
      )
    }

    const centavos = Math.round(Number(input.amount))

    if (!Number.isFinite(centavos) || centavos <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "O valor do pagamento é inválido."
      )
    }

    const documento = construirPreferencia({
      sessionId,
      centavos,
      metodo: this.metodo,
      descricao: String((input.data?.descricao as string) ?? DESCRICAO_PADRAO),
      backUrls: urlsDeRetorno(),
      urlNotificacao: urlDeNotificacao(),
    })

    const preferencia = await criarPreferencia(documento)
    const initPoint = pontoDeInicio(preferencia)

    if (!initPoint) {
      // O provedor respondeu 200 sem endereço de checkout. Sem isto a cliente
      // clicaria num botão que não leva a lugar nenhum, e o erro apareceria
      // como "a loja não funciona" — que é a pior forma de reportar um bug.
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "O Mercado Pago não devolveu o endereço do checkout. Tente novamente."
      )
    }

    this.logger_.info(
      `[mercadopago/${this.metodo}] preferência criada para a sessão ` +
        `${idMascarado(sessionId)} · ${emReais(centavos).toFixed(2)} BRL`
    )

    return {
      // O id da sessão no provedor é o da preferência: é o que permite reabrir
      // o checkout a partir do painel do Mercado Pago.
      id: String(preferencia.id ?? sessionId),
      status: "pending",
      data: {
        provider_id: this.meuId,
        metodo: this.metodo,
        // O que o storefront lê para redirecionar — ver `adapter` no frontend.
        init_point: initPoint,
        preference_id: preferencia.id,
        // A chave que liga a notificação de volta a este carrinho.
        session_id: sessionId,
        external_reference: sessionId,
      },
    }
  }

  /**
   * A decisão do webhook. **É aqui que um pedido pago pode nascer.**
   *
   * Cinco checagens, nesta ordem, e todas fecham para o mesmo lado — "não faço
   * nada":
   *
   * 1. **A assinatura confere?** Sem isso, o resto é irrelevante: qualquer um
   *    pode mandar o corpo que quiser. Falha aqui é 401 do lado de quem chama
   *    (a rota), e aqui é `not_supported`.
   * 2. **O evento é sobre um pagamento?** Um `merchant_order` ou um evento de
   *    plano não tem o que fazer neste provider.
   * 3. **O provedor confirma?** `GET /v1/payments/{id}`. O status que decide é
   *    esse, **nunca** o do corpo — o corpo é do remetente, e o remetente pode
   *    estar errado ou mentindo.
   * 4. **O valor bate com a sessão?** Um pagamento aprovado de R$ 1,00
   *    notificado com o id da sessão de um pedido de R$ 1.000,00 seria um pedido
   *    de mil reais pago com um real. A conferência é contra o valor que **nós**
   *    gravamos, não contra o que o corpo diz.
   * 5. **A sessão é deste provider?** O `external_reference` tem de apontar para
   *    uma sessão de pagamento **deste** método. É o que impede que uma
   *    notificação legítima do Pix seja processada pelo provider do cartão (e
   *    vice-versa), e o que faz um id de pagamento alheio não ter efeito nenhum.
   *
   * **Por que a checagem 5 não é paranoia.** A rota escolhe o provider pelo
   * caminho da URL — um valor que quem envia também controla. Validar de novo
   * aqui é o que faz a rota poder ser burlada **sem consequência**: no máximo o
   * evento cai no provider errado, e o provider errado o recusa.
   *
   * **O que sai daqui nunca veio do corpo.** `session_id` e `amount` são lidos do
   * que temos gravado e do que o provedor respondeu. O corpo contribui com
   * **um** dado: o id do pagamento, que é o que se precisa para perguntar o
   * resto.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
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
      this.logger_.warn(
        `[mercadopago/${this.metodo}] notificação recusada (${veredito.motivo})`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const tipo = tipoDoEvento(corpo)

    // ---------------------------------------------------------------------
    // O contexto que **só a nossa rota** pode produzir.
    //
    // Ele carrega o que o corpo não tem e o provider não pode descobrir
    // sozinho: de qual sessão o pagamento é, quanto ela vale e de qual
    // provider ela é. A rota o monta depois de conferir a assinatura e a
    // sessão, e o provider **confere de novo** tudo o que dá para conferir.
    //
    // **Esta é a barreira contra a rota nativa.** O Medusa publica
    // `POST /hooks/payment/:provider`, que emite exatamente o mesmo evento
    // **sem** este contexto — e ele não valida assinatura nenhuma, porque não
    // conhece nenhum provedor. Sem esta checagem, a rota nativa seria uma porta
    // dos fundos: um POST sem assinatura chegaria ao `getWebhookActionAndData`
    // e, se o provider confiasse no corpo, criaria um pedido pago. Com ela, o
    // pior que acontece ali é um log e um 200 sem efeito.
    // ---------------------------------------------------------------------
    const contexto = (payload as { rv?: ContextoVerificado })?.rv
    const id = idDoPagamento(corpo)

    if (!contexto?.session_id || !id) {
      this.logger_.warn(
        `[mercadopago/${this.metodo}] evento sem contexto verificado — ` +
          `ignorado (a rota nativa não é uma porta de entrada válida)`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
    }

    if (String(contexto.provider_id) !== this.meuId) {
      // O evento é do outro meio (ou de outro provedor inteiro). Recusar aqui, e
      // não antes, é o que torna a checagem independente de quem chamou.
      this.logger_.warn(
        `[mercadopago/${this.metodo}] evento da sessão ` +
          `${idMascarado(contexto.session_id)} é de outro provider — ignorado`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
    }

    if (tipo && tipo !== "payment") {
      this.logger_.info(
        `[mercadopago/${this.metodo}] evento ignorado (tipo=${tipo})`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const pagamento = await buscarPagamento(id)
    const referencia = String(pagamento?.external_reference ?? "")

    if (!referencia) {
      // Sem `external_reference` não há como ligar o pagamento a um carrinho —
      // e um pagamento que não se liga a carrinho nenhum não pode criar pedido.
      this.logger_.warn(
        `[mercadopago/${this.metodo}] pagamento ${idMascarado(id)} sem external_reference`
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
      this.logger_.error(
        `[mercadopago/${this.metodo}] DIVERGÊNCIA: o pagamento ${idMascarado(id)} ` +
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
      this.logger_.error(
        `[mercadopago/${this.metodo}] VALOR DIVERGENTE no pagamento ` +
          `${idMascarado(id)}: provedor=${centavosDoProvedor} ` +
          `sessão=${centavosDaSessao}. O pagamento não será aplicado; confira ` +
          `manualmente no painel do Mercado Pago.`
      )

      return { action: PaymentActions.NOT_SUPPORTED }
    }

    return this.decidir(pagamento, referencia, centavosDaSessao)
  }

  /**
   * Traduz o status **já validado** na ação que o Medusa executa.
   *
   * Está separado de `getWebhookActionAndData` porque a decisão é a parte que
   * interessa conferir: as cinco checagens lá são pré-condição, e misturar as
   * duas coisas num `switch` de trinta linhas é como a checagem 4 some numa
   * refatoração sem ninguém notar.
   */
  protected decidir(
    pagamento: Record<string, unknown>,
    referencia: string,
    centavos: number
  ): WebhookActionResult {
    const status = String(pagamento?.status ?? "error")

    this.logger_.info(
      `[mercadopago/${this.metodo}] ${idMascarado(pagamento?.id)} · ${status} · ` +
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
        this.logger_.warn(
          `[mercadopago/${this.metodo}] status "${status}" não tratado — ` +
            `nenhuma ação tomada (${idMascarado(pagamento?.id)})`
        )

        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }

  /**
   * Autoriza a sessão — **e é a última barreira antes de um pedido existir.**
   *
   * O Medusa chama este método no fim do `processPaymentWorkflow`, um passo
   * antes de completar o carrinho. Se ele devolver `authorized`, o pedido nasce.
   * Se devolver qualquer outra coisa, `authorizePaymentSessionStep` **lança**
   * (`PAYMENT_AUTHORIZATION_ERROR`) e o carrinho **não** é completado — nenhum
   * pedido, nenhuma reserva de estoque.
   *
   * **O que autoriza.** O selo `mp_confirmacao` que a rota gravou no `data` da
   * sessão, e **só ele**. Esse selo só existe se, antes, alguém: (1) apresentou
   * uma assinatura HMAC válida de um segredo nosso, (2) o provedor confirmou que
   * o pagamento existe e está `approved`, (3) o valor bateu com o da sessão e
   * (4) a sessão é deste provider. Sem webhook, sem selo — e sem selo,
   * `authorizePayment` devolve `error`.
   *
   * **Por que o selo é necessário, se o webhook já decidiu.** Porque
   * `authorizePayment` **também** é alcançável por `POST /store/carts/:id/complete`.
   * O storefront não usa esse caminho — o adapter de um meio `redirect`
   * redireciona em vez de completar (ver `frontend/src/lib/payments/adapters`) —
   * mas "o frontend não faz isso" é a garantia mais frágil do mundo: um dia
   * alguém chama a API direto, e o resultado seria um pedido pago sem pagamento.
   * O selo move a garantia de "o cliente não faz" para "o servidor exige", que é
   * o único lugar onde ela sobrevive a uma refatoração.
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const selo = input.data?.mp_confirmacao as Record<string, unknown> | undefined

    if (!selo?.payment_id) {
      this.logger_.warn(
        `[mercadopago/${this.metodo}] autorização sem confirmação de pagamento ` +
          `— recusada (o pagamento ainda não foi confirmado)`
      )

      // `error` não é devolver "talvez": é a resposta honesta para "não há
      // pagamento confirmado para esta sessão", e é o que impede o pedido de
      // existir. O `data` volta intacto para que uma autorização posterior
      // (quando o webhook chegar) funcione sem recriar a sessão.
      return { status: "error", data: input.data }
    }

    this.logger_.info(
      `[mercadopago/${this.metodo}] autorizando com o pagamento ` +
        `${idMascarado(selo.payment_id)}`
    )

    return { status: "authorized", data: input.data }
  }

  /**
   * A captura do dinheiro — e ela **não é feita aqui**.
   *
   * Com o Mercado Pago, o `approved` já significa **capturado**: a preferência
   * não pede captura adiada (`capture: false`), então o dinheiro está na conta
   * antes de a notificação chegar. Existe a chamada de captura adiada, e **não**
   * usá-la é a decisão: captura adiada significa cobrar a cliente e depois
   * cobrar de novo, com um estado "autorizado mas não capturado" para alguém
   * acompanhar. Não compensa o que a loja ganha.
   *
   * Este método é exigido pelo contrato do Medusa e o cumpre devolvendo o `data`
   * que recebeu. Fazer dele um no-op **documentado** é diferente de fazer dele
   * um no-op: quem ler depois precisa saber que a ausência de chamada é
   * deliberada, e não um `TODO` esquecido.
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  /**
   * Cancela um pagamento pendente no provedor.
   *
   * Um Pix gerado e não pago é cancelável; um pagamento aprovado, não (isso é
   * estorno). O Medusa chama este método quando o carrinho é abandonado.
   * Devolve o `data` sem chamar nada: o QR do Pix do Mercado Pago expira
   * sozinho, e forçar um cancelamento traria uma chamada a mais para o mesmo
   * resultado. Fica registrado, para quem procurar, que a decisão é essa.
   */
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  /** O Medusa descarta a sessão do lado dele; o provedor não tem o que apagar. */
  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  /**
   * O valor ou a descrição da sessão mudaram.
   *
   * **A preferência já criada não muda de valor no Mercado Pago.** Um carrinho
   * cujo total mudou depois de a sessão existir precisa de uma preferência nova
   * — e o Medusa faz isso criando uma sessão nova, não atualizando esta. Este
   * método, então, só preserva o `data`; o `warn` existe para que uma cobrança
   * divergente deixe rastro em vez de virar um mistério de conciliação.
   */
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const anterior = Number((input.data?.valor_original_centavos as number) ?? NaN)
    const agora = Math.round(Number(input.amount))

    if (Number.isFinite(anterior) && anterior !== agora) {
      this.logger_.warn(
        `[mercadopago/${this.metodo}] a sessão mudou de ` +
          `${emReais(anterior).toFixed(2)} para ${emReais(agora).toFixed(2)} BRL — ` +
          `a preferência já criada continua com o valor antigo; uma sessão nova ` +
          `deve ser criada`
      )
    }

    return { data: input.data }
  }

  /**
   * O estado do pagamento, para o storefront e para o admin.
   *
   * `data.session_id` é a chave: é o `external_reference` que o provedor
   * guardou. Sem ele não há o que consultar, e a resposta é `error` — nunca
   * `pending`, que faria uma tela de confirmação dizer "aguardando" para sempre
   * num pagamento que não existe.
   */
  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const referencia = String((input.data?.session_id as string) ?? "")

    if (!referencia) {
      return { status: "error", data: input.data }
    }

    const encontrado = await this.ultimoPagamento(referencia)

    if (!encontrado) {
      // Nenhum pagamento ainda: é o estado normal de quem abriu o checkout e não
      // pagou. `pending` aqui é correto e é o que a página de confirmação
      // mostra — "aguardando" é a verdade.
      return { status: "pending", data: input.data }
    }

    const status = String(encontrado.status ?? "error")

    return {
      status: statusDaSessao(status),
      data: {
        ...input.data,
        // Registro do que o provedor respondeu, **já redigido** — é o que a
        // página de confirmação pode mostrar à cliente sem vazar nada dela.
        mp: redigirPagamento(encontrado),
        mp_status: status,
      },
    }
  }

  /**
   * Recusa estorno com uma instrução, em vez de silêncio.
   *
   * Não é limitação de código: é uma decisão sobre dinheiro. Devolver valor a
   * partir de um clique no admin significaria que todo o caminho de estorno
   * precisa ser tão verificado quanto o de cobrança, e que um erro de operação
   * vira dinheiro fora. O estorno é feito no painel do Mercado Pago, onde há
   * trilha de auditoria própria, e o registro é manual.
   *
   * Falhar com a instrução é melhor do que "não fazer nada": quem clica precisa
   * saber **onde** fazer, e um botão que não responde é o que transforma uma
   * decisão em um bug relatado.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const pagamento = await this.ultimoPagamento(
      String((input.data?.session_id as string) ?? "")
    )

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "O estorno é feito no painel do Mercado Pago. " +
        `Procure o pagamento ${idMascarado(pagamento?.id)} (R$ ` +
        `${Number(pagamento?.transaction_amount ?? 0).toFixed(2)}) em ` +
        "Atividade → Pagamentos e estorne por lá."
    )
  }

  /**
   * O pagamento, pelo id do provedor — **já redigido**.
   *
   * O Medusa usa isto para sincronizar o registro dele com o do provedor. A
   * resposta passa por `redigirPagamento` porque este objeto é persistido e
   * exibido no painel: é a mesma fronteira de PII, por outro caminho.
   */
  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const id = String((input.data?.mp_payment_id as string) ?? "")

    if (!id) {
      return { data: input.data }
    }

    return {
      data: {
        ...input.data,
        mp: redigirPagamento(await buscarPagamento(id)),
      },
    }
  }

  /**
   * O pagamento mais recente de uma sessão, no provedor.
   *
   * Um `external_reference` pode ter mais de um pagamento (a cliente tentou,
   * falhou e tentou de novo), então a escolha **não é "o primeiro que vier"**:
   * uma tentativa recusada ao lado de um pagamento aprovado precisa resolver
   * para o aprovado, senão a página de confirmação diria "recusado" para um
   * pedido pago. A ordem é "aprovado ganha; senão, o mais recente".
   *
   * Falha do provedor vira `undefined` — e `undefined` faz o chamador responder
   * "ainda não sei", que é a resposta honesta. Lançar aqui viraria erro no
   * painel por causa de uma instabilidade momentânea.
   */
  protected async ultimoPagamento(
    referencia: string
  ): Promise<Record<string, unknown> | undefined> {
    if (!referencia) {
      return undefined
    }

    try {
      const encontrados = await buscarPorReferencia(referencia)

      if (!encontrados.length) {
        return undefined
      }

      return (
        encontrados.find((p) => String(p?.status) === "approved") ?? encontrados[0]
      )
    } catch (e) {
      this.logger_.warn(
        `[mercadopago/${this.metodo}] não foi possível consultar a sessão ` +
          `${idMascarado(referencia)}: ${(e as Error)?.message}`
      )

      return undefined
    }
  }
}
