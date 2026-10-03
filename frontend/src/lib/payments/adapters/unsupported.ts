/**
 * O adapter de meio desconhecido.
 * -------------------------------------------------------------------------
 * `resolvePayment` **nunca** devolve `undefined`. Este é o que ele devolve
 * quando nenhum adapter responde pelo id.
 *
 * O caso que ele cobre é real e não é raro: um `provider_id` gravado no banco
 * por uma versão futura do backend, por um seed antigo, ou à mão. Sem este
 * adapter, esse id chegaria como `undefined` e o checkout teria um `?.[0]`
 * espalhado por todos os call sites — um deles esqueceria, e a página cairia.
 *
 * É também a resposta honesta: "forma de pagamento indisponível" é mais útil
 * que um 500, e mais útil que um botão que finge funcionar.
 */
import type { PaymentAdapter } from "../types"

export const UNSUPPORTED_MESSAGE =
  "Esta forma de pagamento não está disponível no momento. Escolha outra ou fale com a gente."

export const unsupportedAdapter: PaymentAdapter = {
  id: "unsupported",
  label: "Indisponível",
  icon: null,
  capabilities: {
    pix: false,
    cards: false,
    boleto: false,
    interestFree: false,
  },
  fulfillment: "external",
  /**
   * `external` de propósito: não há nada a iniciar nem a desenhar, e o checkout
   * trata `external` como "o botão é finalizar pedido" — que, para um meio
   * indisponível, nunca é clicável porque o `paymentReady` é falso.
   *
   * **Sem `InlineUI`** — é o que o diferencia de um meio `inline` real: o
   * checkout não acha componente nenhum para desenhar, e mostra só a linha de
   * seleção com o rótulo "Indisponível".
   */
}
