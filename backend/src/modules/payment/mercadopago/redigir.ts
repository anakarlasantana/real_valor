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
 * Os nomes de campo que nunca saem, em qualquer profundidade.
 *
 * Comparados em minúsculas e sem `_`/`-`, para que `firstName`, `first_name` e
 * `first-name` caiam todos na mesma regra — o provedor já trocou a convenção de
 * nomes uma vez, e a lista não deveria precisar acompanhar.
 */
const CAMPOS_PROIBIDOS = [
  "email",
  "firstname",
  "lastname",
  "name",
  "phone",
  "identification",
  "cpf",
  "cnpj",
  "cardholder",
  "billingaddress",
  "shippingaddress",
  "additionalinfo",
  "address",
  "zipcode",
  "streetname",
  "streetnumber",
  "token",
  "accesstoken",
  "authorization",
  "card",
  "securitycode",
] as const

/** O texto que substitui o que não pode sair. Diz o que aconteceu, não o valor. */
export const REDIGIDO = "[REDIGIDO]"

/** Chaves que, se a chave terminar com elas, são volume/diagnóstico e não identidade. */
const CHAVES_TECNICAS = [
  "id",
  "type",
  "status",
  "detail",
  "method",
  "currency",
  "amount",
  "date",
] as const

/** `first_name` → `firstname`. A normalização da comparação. */
function normalizar(chave: string): string {
  return chave.toLowerCase().replace(/[_-]/g, "")
}

/**
 * Redige, por nome de campo, o que não pode sair — em qualquer profundidade.
 *
 * Usada no log de erro, onde a forma do que chegou é desconhecida. Três
 * limites, todos deliberados: a profundidade para que um ciclo ou um documento
 * gigante não derrube o log, o comprimento das strings para que um campo não
 * mapeado não saia inteiro de carona, e a lista por **nome** porque é a única
 * coisa que se sabe a priori de uma estrutura desconhecida.
 *
 * A exceção de `CHAVES_TECNICAS` existe porque `payment_method_id` e
 * `transaction_amount` são o diagnóstico, e um `number` dentro de `payer` é o
 * dado pessoal — o mesmo sufixo de nome nos dois lados. Sem a exceção, redigir
 * por `number` apagaria o diagnóstico junto com o CPF.
 */
export function semPii(valor: unknown, profundidade = 0, chave = ""): unknown {
  if (profundidade > 6) {
    return REDIGIDO
  }

  if (typeof valor === "string") {
    return valor.length > 120 ? `${valor.slice(0, 120)}…` : valor
  }

  if (
    typeof valor === "number" ||
    typeof valor === "boolean" ||
    valor === null ||
    valor === undefined
  ) {
    return valor
  }

  if (typeof valor !== "object") {
    return String(valor)
  }

  if (Array.isArray(valor)) {
    return valor
      .slice(0, 20)
      .map((item) => semPii(item, profundidade + 1, chave))
  }

  const nome = normalizar(chave)
  const tecnica = CHAVES_TECNICAS.some((parte) => nome.endsWith(parte))

  const saida: Record<string, unknown> = {}

  for (const [campo, conteudo] of Object.entries(
    valor as Record<string, unknown>
  )) {
    const proibido = (CAMPOS_PROIBIDOS as readonly string[]).includes(
      normalizar(campo)
    )

    saida[campo] =
      proibido && !tecnica ? REDIGIDO : semPii(conteudo, profundidade + 1, campo)
  }

  return saida
}
