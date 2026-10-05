/**
 * A preferência do Checkout Pro — o documento que o Mercado Pago recebe.
 * -------------------------------------------------------------------------
 * **O que é uma preferência.** É a "intenção de cobrança": o que está sendo
 * vendido, por quanto, para onde a cliente volta e por qual URL nos avisar.
 * O Mercado Pago devolve um `id` e um `init_point`, e é para lá que a cliente
 * vai. Nosso backend não vê formulário de cartão nenhum — é o que faz o
 * Checkout Pro ser a modalidade com o **menor escopo de PCI possível** para a
 * loja: o dado do cartão nunca passa pela nossa infraestrutura.
 *
 * **Este arquivo é puro.** Recebe números e strings, devolve o documento. Não
 * lê ambiente, não chama a API, não conhece o Medusa — e é por isso que o
 * formato da preferência pode ser conferido por teste, que é o único jeito de
 * conferir um documento que só se sabe estar errado quando a cliente não
 * consegue pagar.
 *
 * **`external_reference` é a chave de tudo.** Ele carrega o id da
 * **payment session** do Medusa, e é o único campo que volta para nós na
 * notificação do webhook. Sem ele, uma notificação de pagamento aprovado não
 * tem como ser ligada a um carrinho — e um pagamento aprovado que não vira
 * pedido é dinheiro recebido sem entrega.
 */
import {
  MERCADOPAGO_CARTAO_PROVIDER_ID,
  MERCADOPAGO_PIX_PROVIDER_ID,
} from "@rv/contrato/payment"

/** Os dois meios que a loja oferece. */
export type Metodo = "pix" | "cartao"

/**
 * O que diferencia um meio do outro, num lugar só.
 *
 * A diferença é de **preferência**, não de código: o mesmo builder monta as
 * duas, e o que muda é a lista de meios excluídos e o limite de parcelas.
 * Ter isso como dado (e não como `if` dentro do builder) é o que permite
 * acrescentar boleto depois sem tocar na função.
 */
export const METODOS: Record<
  Metodo,
  {
    /** O `provider_id` que o Medusa registra (e o registry do storefront resolve). */
    providerId: string
    /** O rótulo que a cliente lê. */
    rotulo: string
    /**
     * Os meios do Mercado Pago a **excluir** para sobrar só este.
     *
     * ⚠️ **É uma preferência de interface, não uma garantia.** O que a cliente
     * pode escolher no site do Mercado Pago é a interface dele. Se ela pagar
     * com um meio diferente do que escolheu aqui, **o dinheiro entra do mesmo
     * jeito** — a cobrança é da mesma conta — e o fluxo continua correto porque
     * o webhook resolve o provider pela sessão, não pelo meio escolhido (ver
     * `webhook.ts`). Tratar isto como fronteira de segurança seria confundir
     * conveniência com controle.
     */
    excluidos: { id: string }[]
    /** Até quantas parcelas. `1` é à vista. */
    parcelas: number
  }
> = {
  pix: {
    providerId: MERCADOPAGO_PIX_PROVIDER_ID,
    rotulo: "Pix",
    // O Pix do Mercado Pago é `bank_transfer`; o resto sai para a cliente não
    // cair numa tela de cartão depois de ter escolhido Pix na nossa.
    excluidos: [
      { id: "credit_card" },
      { id: "debit_card" },
      { id: "prepaid_card" },
      { id: "ticket" },
      { id: "atm" },
      { id: "account_money" },
    ],
    parcelas: 1,
  },
  cartao: {
    providerId: MERCADOPAGO_CARTAO_PROVIDER_ID,
    rotulo: "Cartão de crédito",
    excluidos: [
      { id: "ticket" },
      { id: "atm" },
      { id: "bank_transfer" },
      { id: "account_money" },
    ],
    parcelas: 12,
  },
}

/** Todos os meios, na ordem em que aparecem. */
export const TODOS_OS_METODOS: Metodo[] = ["pix", "cartao"]

/**
 * Qual meio atende um `provider_id` do Medusa?
 *
 * Devolve `undefined` para o que não é nosso, e isso é a resposta certa: o
 * `pp_system_default` do Medusa cai aqui, e quem chama precisa poder
 * distinguir "não é Mercado Pago" de "é Mercado Pago e eu não reconheci" —
 * o segundo seria um bug de registro, não um caso de borda.
 */
export function metodoDoProviderId(providerId: unknown): Metodo | undefined {
  const alvo = String(providerId ?? "")
  return TODOS_OS_METODOS.find((m) => METODOS[m].providerId === alvo)
}

/**
 * Converte centavos em reais, do jeito que o Mercado Pago espera.
 *
 * ⚠️ **O erro de unidade aqui é o mais caro do módulo.** O Medusa trabalha em
 * centavos e o Mercado Pago em reais decimais: um `unit_price: 18990` cobra
 * **R$ 18.990,00** por uma peça de R$ 189,90 — e o checkout **funciona**, o
 * que é a parte assustadora. A divisão mora nesta função para que exista
 * exatamente um lugar para conferir.
 *
 * O `Number` de saída é do próprio JSON: `189.9` e não `"189.90"`. O Mercado
 * Pago aceita string, mas o número evita uma segunda conversão de ida.
 */
export function emReais(centavos: number): number {
  // Duas casas, sem o `0.1 + 0.2` do ponto flutuante chegar no payload.
  return Math.round(Number(centavos)) / 100
}

/** O que é preciso saber para montar a preferência. */
export type EntradaDaPreferencia = {
  /** O id da **payment session** do Medusa. Vira o `external_reference`. */
  sessionId: string
  /** O valor, em **centavos** (a unidade do Medusa). */
  centavos: number
  metodo: Metodo
  descricao: string
  /** As três URLs de volta, ou `undefined` para deixar a cliente no provedor. */
  backUrls?: Record<string, string>
  /** A URL pública do nosso webhook, ou `""` para não configurar. */
  urlNotificacao?: string
  /** Minutos até a preferência expirar. `0` desliga (ver o comentário abaixo). */
  expiracaoMinutos?: number
  /** O "agora", injetável para o teste não depender do relógio. */
  agora?: Date
}

/** Como o Mercado Pago espera uma data. `Z` é o offset, e ele é obrigatório. */
function dataDoProvedor(quando: Date): string {
  return quando.toISOString()
}

/**
 * Monta o documento da preferência.
 *
 * **A forma é fechada de propósito.** Todo campo abaixo é escolhido, e não
 * repassado: um `...input` no meio transformaria este builder num espelho do
 * que o Medusa mandou, e a próxima pessoa a chamar `initiatePayment` com um
 * campo a mais estaria, sem saber, escrevendo no Mercado Pago. Escrever a
 * lista de campos à mão é o que faz "o que sai daqui?" ter resposta.
 *
 * **A expiração é opt-in, e o motivo é de risco medido.** Um formato de data
 * que o provedor recuse derruba a criação da preferência inteira — ou seja,
 * derruba o checkout — e é a única validação daqui que eu **não** posso
 * conferir sem credencial. Com `expiracaoMinutos` ausente, o documento sai sem
 * `expires`, o que é seguro: o próprio QR do Pix tem a validade dele do lado
 * do Mercado Pago, independentemente desta preferência.
 */
export function construirPreferencia(
  entrada: EntradaDaPreferencia
): Record<string, unknown> {
  const meio = METODOS[entrada.metodo]

  const preferencia: Record<string, unknown> = {
    items: [
      {
        // O id do item é a própria sessão: é o que permite, numa consulta ao
        // painel do Mercado Pago, ligar a cobrança de volta a um carrinho.
        id: entrada.sessionId,
        title: entrada.descricao,
        quantity: 1,
        currency_id: "BRL",
        unit_price: emReais(entrada.centavos),
      },
    ],
    // O caminho de volta: é este campo que o webhook devolve, e sem ele o
    // pagamento aprovado não sabe a que carrinho pertence.
    external_reference: entrada.sessionId,
    statement_descriptor: "REALVALOR",
    payment_methods: {
      excluded_payment_types: meio.excluidos,
      installments: meio.parcelas,
    },
    // `binary_mode` fica de fora de propósito: ele faz o provedor devolver só
    // aprovado ou recusado, sem o estado "pendente" — e o Pix **é** pendente
    // por natureza. Ligá-lo quebraria o único meio que a loja mais quer.
  }

  const urls = entrada.backUrls

  if (urls && Object.keys(urls).length) {
    preferencia.back_urls = urls

    // `auto_return: "approved"` só é aceito quando há `back_urls` — mandar
    // sozinho é um 400 do provedor, e não um campo ignorado.
    preferencia.auto_return = "approved"
  }

  if (entrada.urlNotificacao) {
    preferencia.notification_url = entrada.urlNotificacao
  }

  const minutos = Number(entrada.expiracaoMinutos ?? 0)

  if (Number.isFinite(minutos) && minutos > 0) {
    const agora = entrada.agora ?? new Date()
    const fim = new Date(agora.getTime() + minutos * 60_000)

    preferencia.expires = true
    preferencia.expiration_date_from = dataDoProvedor(agora)
    preferencia.expiration_date_to = dataDoProvedor(fim)
  }

  return preferencia
}
