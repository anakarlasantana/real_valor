/**
 * Falha ≠ vazio: `null` é "não deu para perguntar"; `[]` é "perguntamos e não
 * há entrega". O `CheckoutForm` tratava os dois como `null` e a página sumia.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
export type EstadoDaEntrega<T> =
  | { estado: "ok"; opcoes: T[] }
  | { estado: "sem-opcoes" }
  | { estado: "indisponivel" }

export function classificarOpcoesDeEntrega<T>(
  opcoes: T[] | null | undefined
): EstadoDaEntrega<T> {
  if (!opcoes) {
    return { estado: "indisponivel" }
  }

  if (opcoes.length === 0) {
    return { estado: "sem-opcoes" }
  }

  return { estado: "ok", opcoes }
}
