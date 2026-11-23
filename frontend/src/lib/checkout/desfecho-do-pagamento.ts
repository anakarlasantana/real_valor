export type Desfecho =
  | { tipo: "pedido"; id: string }
  | { tipo: "aguardando" }
  | { tipo: "recusado" }
  | { tipo: "indisponivel" }
  | { tipo: "esperar" }

export function desfechoDaResposta(status: number, corpo: unknown): Desfecho {
  const dados = (corpo ?? {}) as { id?: unknown; pagamento?: unknown }

  if (status === 200 && typeof dados.id === "string" && dados.id) {
    return { tipo: "pedido", id: dados.id }
  }

  if (status === 503) {
    return { tipo: "indisponivel" }
  }

  if (status === 404 && dados.pagamento === "recusado") {
    return { tipo: "recusado" }
  }

  if (status === 404 || status === 200) {
    return { tipo: "aguardando" }
  }

  return { tipo: "esperar" }
}
