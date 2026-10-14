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

  protected logger_: Registrador

  constructor(container: Dependencias, options: Record<string, unknown>) {
    super(container as never, options)

    this.logger_ = container.logger

    // O log de boot inteiro mora em `boot.ts`: é o único lugar onde se
    // descobre que a variável não chegou no container, e ele é **antes** de
    // qualquer cliente tentar pagar. Só a presença e a forma saem de lá.
    anunciarBoot(this.logger_, this.metodo)
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
   * A decisão do webhook — **é aqui que um pedido pago pode nascer**.
   *
   * O Medusa chama este método e espera a ação; as cinco checagens, na
   * ordem, e o porquê de cada uma moram em `decisao.ts`. O contrato do
   * método e o que ele pode devolver estão no README do módulo. Aqui só se
   * entrega quem é este provider: o `metodo`, o `meuId` que a sessão precisa
   * citar e o logger.
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
      instrucaoDeEstorno(pagamento)
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
