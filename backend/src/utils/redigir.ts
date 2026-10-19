/**
 * O que pode sair de um corpo de erro de plataforma terceira.
 * -------------------------------------------------------------------------
 * Não é do Mercado Pago: o SuperFrete devolve o destinatário no corpo do erro.
 */

/** Os nomes de campo que nunca saem — comparados sem `_`/`-` e em minúsculas. */
export const CAMPOS_PROIBIDOS = [
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

/** O que substitui o que não pode sair: diz o que aconteceu, não o valor. */
export const REDIGIDO = "[REDIGIDO]"

/** Sufixos de chave que são diagnóstico, não identidade. */
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

/** `first_name` → `firstname`. */
function normalizar(chave: string): string {
  return chave.toLowerCase().replace(/[_-]/g, "")
}

/** Redige o que não pode sair, por nome de campo, em qualquer profundidade. */
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
