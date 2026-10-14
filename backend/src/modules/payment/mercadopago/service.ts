/**
 * O provider do Mercado Pago — a base que Pix e cartão compartilham (mesma
 * conta, token e webhook). Toda decisão sai de `GET /v1/payments/{id}`, nunca
 * do corpo do webhook. A idempotência é do Medusa, não daqui.
 */
import {
  AbstractPaymentProvider,
  MedusaError,
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
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/types"

import { anunciarBoot, type Registrador } from "./boot"
import {
  buscarPagamento,
  buscarPorReferencia,
  criarPreferencia,
  pontoDeInicio,
} from "./cliente"
import {
  pagamentoDisponivel,
  urlDeNotificacao,
  urlsDeRetorno,
} from "./credenciais"
import { decidirNotificacao } from "./decisao"
import { instrucaoDeEstorno } from "./estorno"
import {
  METODOS,
  construirPreferencia,
  emReais,
  type Metodo,
} from "./preferencia"
import { idMascarado, redigirPagamento } from "./redigir"
import { statusDaSessao } from "./status"

/** O que o Medusa injeta no provider. Só `logger` é usado. */
type Dependencias = {
  logger: Registrador
}

/** A descrição que aparece no checkout, quando o carrinho não manda a sua. */
const DESCRICAO_PADRAO = "Real Valor — pedido"

/**
 * A base dos dois providers. `metodo` é a **única** coisa que a subclasse diz;
 * `identifier` é o mesmo (`mercadopago`), e o que os separa é o `id` da lista
 * em `medusa-config.ts`. `metodo` é `static` porque o construtor o lê: um campo
 * de instância só existiria depois do `super()`, e o log sairia `undefined`.
 */
export abstract class MercadoPagoProvider extends AbstractPaymentProvider {
  static identifier = "mercadopago"

  /** Qual meio esta subclasse atende. Cada uma define o seu. */
  static metodo: Metodo

  /** O meio desta instância, lido da classe. */
  protected get metodo(): Metodo {
    return (this.constructor as typeof MercadoPagoProvider).metodo
  }

  protected logger_: Registrador

  constructor(container: Dependencias, options: Record<string, unknown>) {
    super(container as never, options)

    this.logger_ = container.logger

    // O log de boot inteiro mora em `boot.ts`, antes de qualquer cliente pagar.
    anunciarBoot(this.logger_, this.metodo)
  }

  /** O `provider_id` que o Medusa registra e o storefront resolve. */
  protected get meuId(): string {
    return METODOS[this.metodo].providerId
  }

  /**
   * Cria a preferência e devolve o endereço do checkout. O `session_id` entra no
   * `data` devolvido, e é obrigatório: é dele que `authorizePayment` e
   * `getPaymentStatus` leem a sessão depois. O valor sai daqui em centavos e
   * viaja em reais (`construirPreferencia`), num lugar só.
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
      // O provedor respondeu 200 sem endereço de checkout: sem isto a cliente
      // clicaria num botão que não leva a lugar nenhum.
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
      // O id da sessão no provedor é o da preferência: permite reabrir o checkout.
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
   * A decisão do webhook — **é aqui que um pedido pago pode nascer**. As cinco
   * checagens, na ordem, e o porquê de cada uma moram em `decisao.ts`; aqui só se
   * entrega quem é este provider (o `metodo`, o `meuId` e o logger).
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return decidirNotificacao(payload, {
      metodo: this.metodo,
      meuId: this.meuId,
      logger: this.logger_,
    })
  }

  /**
   * Autoriza a sessão — **a última barreira antes de um pedido existir**. O
   * Medusa chama no fim do `processPaymentWorkflow`; devolver algo além de
   * `authorized` faz `authorizePaymentSessionStep` **lançar**. Quem autoriza é o
   * selo `mp_confirmacao` da sessão, e **só ele** (o `complete` também chega aqui).
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

      // `error` é a resposta honesta para "sem pagamento confirmado": impede o
      // pedido de existir. O `data` volta para uma autorização posterior.
      return { status: "error", data: input.data }
    }

    this.logger_.info(
      `[mercadopago/${this.metodo}] autorizando com o pagamento ` +
        `${idMascarado(selo.payment_id)}`
    )

    return { status: "authorized", data: input.data }
  }

  /**
   * A captura **não é feita aqui**: com Mercado Pago, `approved` já significa
   * capturado. O método cumpre o contrato devolvendo o `data` — no-op deliberado.
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  /**
   * Cancela um pagamento pendente no provedor. Devolve o `data` sem chamar nada:
   * o QR do Pix expira sozinho, e forçar o cancelamento seria chamada a mais
   * para o mesmo resultado. O Medusa chama quando o carrinho é abandonado.
   */
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  /** O Medusa descarta a sessão do lado dele; o provedor não tem o que apagar. */
  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  /**
   * O valor ou a descrição mudaram. A preferência já criada **não muda de valor**
   * no Mercado Pago; só o `data` é preservado, com um `warn` de divergência.
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
   * O estado do pagamento. `data.session_id` é a chave (`external_reference`);
   * sem ele é `error` — nunca `pending`, que faria a confirmação "aguardar".
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
      // Nenhum pagamento ainda é o normal de quem abriu o checkout e não pagou:
      // `pending` é a verdade, e é o que a confirmação mostra.
      return { status: "pending", data: input.data }
    }

    const status = String(encontrado.status ?? "error")

    return {
      status: statusDaSessao(status),
      data: {
        ...input.data,
        // Registro do que o provedor respondeu, **já redigido**: a confirmação
        // pode mostrar à cliente sem vazar nada dela.
        mp: redigirPagamento(encontrado),
        mp_status: status,
      },
    }
  }

  /**
   * Recusa estorno com uma instrução, em vez de silêncio. Não é limitação: é
   * decisão sobre dinheiro — o estorno é feito no painel do Mercado Pago, com
   * trilha de auditoria própria. Quem clica precisa saber **onde** fazer.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const pagamento = await this.ultimoPagamento(
      String((input.data?.session_id as string) ?? "")
    )

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      instrucaoDeEstorno(pagamento)
    )
  }

  /**
   * O pagamento pelo id do provedor — **já redigido**, porque o objeto é
   * persistido e exibido no painel: a mesma fronteira de PII, por outro caminho.
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
   * O pagamento mais recente de uma sessão. Um `external_reference` pode ter
   * mais de um (tentou, falhou, tentou de novo): "aprovado ganha; senão, o mais
   * recente". Falha do provedor vira `undefined` — a resposta honesta de "ainda
   * não sei", porque lançar viraria erro por instabilidade.
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
