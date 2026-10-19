/**
 * O que pode sair de um pagamento do Mercado Pago — e o que nunca sai.
 * -------------------------------------------------------------------------
 * **O problema.** A resposta de `/v1/payments/{id}` é um documento com dados
 * pessoais: `payer.email`, `payer.first_name`, `payer.last_name`,
 * `payer.phone`, `payer.identification.{type,number}` (o CPF), o endereço de
 * cobrança e o nome do titular do cartão. Ela é a coisa mais conveniente do
 * mundo para debugar, e é exatamente por isso que ela acaba num `console.log`
 * e, de lá, num arquivo de log que fica meses no disco — um vazamento de dados
 * pessoais que ninguém decidiu cometer.
 *
 * **A regra, e ela não tem exceção.** Não se guarda "quase tudo"; guarda-se
 * uma **lista fechada** do que serve. Todo campo fora da lista é descartado —
 * inclusive campos que o Mercado Pago acrescentar no futuro, que é o ponto: uma
 * lista de proibições envelhece a cada campo novo, uma lista de permissões não.
 *
 * **Este é o único caminho de saída.** `redigirPagamento` é usado no lugar de
 * `JSON.stringify(pagamento)` em cada lugar que registra ou devolve o
 * pagamento. Não existe porta neste módulo que devolva o objeto cru.
 *
 * **Por que também há `semPii`.** Há um segundo ponto de saída — o log de erro,
 * que precisa registrar **o que o provedor mandou** quando algo dá errado. Ali
 * a forma é desconhecida (pode ser um erro, uma lista, qualquer coisa), então a
 * whitelist não serve. `semPii` percorre a estrutura redigindo por **nome de
 * campo**, com uma lista de negação — e lista de negação é aceitável aqui
 * porque a consequência de errar é um log menos útil, não um dado pessoal a
 * mais. Nos dois casos o invariante é o mesmo: o que sai já passou por uma
 * função com nome, e nenhuma delas é a identidade.
 */

/**
 * Os campos que podem sair, e o que cada um responde.
 *
 * Nada aqui é dado pessoal: são o estado da cobrança e o endereço dela dentro
 * do Mercado Pago. É o suficiente para atender uma cliente no telefone ("seu
 * pagamento está aprovado, cartão final 4242, 3 parcelas") — que é o que se
 * precisa do documento.
 */
export const CAMPOS_SEGUROS = [
  "id",
  "status",
  "status_detail",
  "payment_method_id",
  "payment_type_id",
  "installments",
  "transaction_amount",
  "transaction_amount_refunded",
  "currency_id",
  "date_created",
  "date_approved",
  "date_last_updated",
  "external_reference",
  "live_mode",
  "captured",
  "operation_type",
] as const

/**
 * Reduz um pagamento do Mercado Pago à lista acima.
 *
 * Devolve `undefined` para uma entrada que não é objeto, e não `{}`: um objeto
 * vazio parece um pagamento sem campos, e "não recebi nada" é uma informação
 * diferente — quem lê o log precisa poder distinguir as duas.
 *
 * O cartão entra **só** pelo `last_four_digits`. O `first_six_digits` (o BIN)
 * fica de fora de propósito: ele identifica o emissor, e nada que a loja
 * precise fazer com este pagamento depende dele. O nome do titular e a
 * identificação nunca entram — nem redigidos, porque a redação de um campo que
 * não precisa existir é uma linha a mais para alguém ter de lembrar depois.
 */
export function redigirPagamento(
  pagamento: unknown
): Record<string, unknown> | undefined {
  if (!pagamento || typeof pagamento !== "object") {
    return undefined
  }

  const bruto = pagamento as Record<string, unknown>
  const limpo: Record<string, unknown> = {}

  for (const campo of CAMPOS_SEGUROS) {
    if (bruto[campo] !== undefined) {
      limpo[campo] = bruto[campo]
    }
  }

  const cartao = bruto.card as Record<string, unknown> | undefined

  if (cartao && typeof cartao === "object" && cartao.last_four_digits) {
    limpo.card = { last_four_digits: cartao.last_four_digits }
  }

  return limpo
}

/**
 * Um id do provedor, mostrado pela metade.
 *
 * Ids de pagamento são o que se pede ao suporte e o que se cola num chamado —
 * e um id inteiro num print de tela é o suficiente para consultar o pagamento
 * na API, se alguém tiver o token. Mostrar os últimos dígitos permite conferir
 * que é "o mesmo pagamento" sem publicar o identificador utilizável.
 */
export function idMascarado(id: unknown): string {
  const texto = String(id ?? "")

  if (!texto) {
    return ""
  }

  // Curto demais para mascarar: mostrar os últimos seis dígitos de um id de
  // cinco caracteres o mostraria inteiro de qualquer jeito, e cortar tudo
  // ("…") não permitiria conferir nada. O corte é para o id de verdade, que
  // tem 9 a 11 dígitos.
  if (texto.length <= 6) {
    return texto
  }

  return `…${texto.slice(-6)}`
}

/**
 * `semPii` e as tabelas de PII moraram aqui e agora vivem em `utils/redigir.ts`
 * — o SuperFrete devolve o destinatário no corpo do erro e precisa da mesma
 * proteção. O reexport mantém o import antigo (`from "../redigir"`) válido.
 */
export { CAMPOS_PROIBIDOS, REDIGIDO, semPii } from "../../../utils/redigir"
