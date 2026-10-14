/** Ler o corpo e os headers de uma notificação — só **localiza**, não decide. */

/** Lê um header sem depender de o servidor ter baixado o nome para minúsculas. */
export function header(headers: Record<string, unknown>, nome: string): unknown {
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
export function idDoPagamento(corpo: Record<string, unknown>): string | undefined {
  const interno = (corpo?.data ?? {}) as Record<string, unknown>
  const candidato = interno?.id ?? corpo?.id

  if (candidato === undefined || candidato === null || String(candidato).trim() === "") {
    return undefined
  }

  return String(candidato)
}

/** O `type` do evento, quando vem. `payment` é o único que nos interessa. */
export function tipoDoEvento(corpo: Record<string, unknown>): string {
  return String(corpo?.type ?? corpo?.topic ?? "")
}
