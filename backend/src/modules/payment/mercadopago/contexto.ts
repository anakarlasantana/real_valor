/**
 * O contexto que a rota verifica e entrega ao provider.
 * -------------------------------------------------------------------------
 * **Por que existe um contrato explícito entre a rota e o provider.** O corpo
 * da notificação do Mercado Pago **não contém** o que é preciso para decidir
 * nada: ele diz "houve um evento no pagamento 123". Quem é o dono daquele
 * pagamento, quanto ele vale e de qual carrinho ele é só se sabe consultando
 * o provedor e o **nosso** banco — e quem tem acesso ao banco é a rota, cujo
 * escopo é o da aplicação inteira.
 *
 * O provider, por outro lado, recebe só o *cradle* do módulo de pagamento.
 * Ler a sessão de lá é possível em teoria e **não verificável** na prática:
 * nenhum provider do Medusa faz isso, e descobrir na primeira venda que não
 * funciona não é uma opção. Este arquivo existe para que a resposta não
 * dependa de nenhuma suposição sobre o container: a rota resolve, o provider
 * **re-verifica**.
 *
 * **Assinar não é opcional.** O campo que os dois trocam entra no `payload`
 * do evento, e o provider **recusa** qualquer evento sem ele. É isso que
 * fecha a rota nativa `POST /hooks/payment/:provider` do Medusa: ela emite o
 * mesmo evento, sem contexto, sem validar assinatura — e sem contexto o
 * provider não faz nada.
 *
 * **O tipo tem um lugar só** porque um contrato duplicado é um contrato que
 * diverge: a rota mudaria o nome de um campo, o provider continuaria lendo o
 * antigo, e o resultado seria "o webhook para de funcionar" sem erro nenhum
 * de compilação.
 */
import type { Metodo } from "./preferencia"

/**
 * A chave do contexto dentro do `payload` do evento.
 *
 * Curta e improvável de colidir, porque o `payload` do Medusa tem apenas
 * `data`, `rawData` e `headers` — e o `data` é o corpo cru do provedor, que
 * este módulo **não** altera. Deixar o contexto ao lado, e não dentro do
 * corpo, é o que permite continuar tratando `data` como "o que o provedor
 * mandou", sem um campo nosso misturado para confundir quem for depurar.
 */
export const CHAVE_CONTEXTO = "rv"

/**
 * O que a rota apurou e o provider confere.
 *
 * ⚠️ **Nada aqui é decidido pelo corpo da notificação.** `session_id`,
 * `provider_id`, `amount` e `currency_code` saem da **sessão de pagamento
 * gravada** pelo Medusa; o provider os compara com o que o provedor respondeu
 * em `GET /v1/payments/{id}`. Um valor inventado aqui não sobrevive à
 * comparação — e é por isso que trafegar isto é seguro: o contexto serve para
 * **dizer de qual sessão se fala**, não para afirmar que o pagamento existe.
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
 * ⚠️ **Sem o prefixo `pp_`.** O módulo de pagamento monta o identificador
 * completo fazendo `` `pp_${eventData.provider}` `` — então `provider` aqui é
 * `mercadopago_pix`, e passar `pp_mercadopago_pix` produziria
 * `pp_pp_mercadopago_pix`, que não existe. O erro apareceria como "Unable to
 * retrieve the payment provider with id", longe daqui.
 */
export function nomeDoProviderNoEvento(metodo: Metodo): string {
  return `mercadopago_${metodo}`
}
