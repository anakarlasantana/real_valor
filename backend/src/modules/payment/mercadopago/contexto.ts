/**
 * O contexto que a rota verifica e entrega ao provider.
 *
 * O corpo da notificação do Mercado Pago **não contém** o que é preciso para
 * decidir nada ("houve um evento no pagamento 123"): quem é o dono, quanto vale e
 * de qual carrinho é só se sabe consultando o provedor e o **nosso** banco — e
 * quem tem o banco é a rota. O provider recebe só o *cradle* do módulo, e ler a
 * sessão de lá é possível em teoria e **não verificável** na prática: aqui a rota
 * resolve, o provider **re-verifica**.
 *
 * **Assinar não é opcional:** o campo trocado entra no `payload` e o provider
 * recusa evento sem ele — é o que fecha a rota nativa `POST /hooks/payment/:provider`.
 *
 * O tipo tem um lugar só porque contrato duplicado diverge em silêncio: a rota
 * renomeia um campo, o provider lê o antigo, e "o webhook para de funcionar" sem
 * erro de compilação.
 */
import type { Metodo } from "./preferencia"

/**
 * A chave do contexto dentro do `payload` do evento — curta porque o `payload` só
 * tem `data`, `rawData` e `headers`. Deixar o contexto ao lado, e não dentro de
 * `data`, é o que permite tratar `data` como "o que o provedor mandou".
 */
export const CHAVE_CONTEXTO = "rv"

/**
 * O que a rota apurou e o provider confere.
 *
 * ⚠️ **Nada aqui é decidido pelo corpo da notificação:** os campos saem da **sessão
 * gravada** pelo Medusa e o provider os compara com o que o provedor respondeu em
 * `GET /v1/payments/{id}`. O contexto serve para **dizer de qual sessão se fala**,
 * não para afirmar que o pagamento existe.
 */
export type ContextoVerificado = {
  /** O id da payment session do Medusa. Também é o `external_reference`. */
  session_id: string
  /** O `provider_id` da sessão (`pp_mercadopago_pix` / `pp_mercadopago_cartao`). */
  provider_id: string
  /** Qual meio, para o log e para o nome do provider no evento. */
  metodo: Metodo
  /** O valor da sessão, em **centavos** — o que o provedor tem de confirmar. */
  amount: number
  /** A moeda da sessão. */
  currency_code: string
}

/**
 * O nome do provider no evento do Medusa.
 *
 * ⚠️ **Sem o prefixo `pp_`:** o módulo monta `` `pp_${eventData.provider}` ``, então
 * `pp_mercadopago_pix` produziria `pp_pp_mercadopago_pix` — e o erro apareceria como
 * "Unable to retrieve the payment provider with id", longe daqui.
 */
export function nomeDoProviderNoEvento(metodo: Metodo): string {
  return `mercadopago_${metodo}`
}
