import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

/**
 * Espera o React assumir um elemento antes de interagir.
 *
 * O `next dev` serve o HTML antes do bundle, e um clique nesse intervalo vira
 * no-op silencioso: o `router.push` do filtro nao sai, a gaveta nao fecha, nada
 * acusa. Esperar `toBeVisible` nao resolve — o elemento ja' esta' la'. A chave
 * interna `__reactProps$` do React so' existe depois da hidratacao, e e' o
 * sinal do produto, nao uma contagem de tempo.
 */
export async function esperarHidratacao(
  alvo: Locator,
  opcoes: { timeout?: number; descricao?: string } = {}
): Promise<void> {
  await expect
    .poll(
      () =>
        alvo.evaluate((el) =>
          Object.keys(el).some((k) => k.startsWith("__reactProps$"))
        ),
      {
        timeout: opcoes.timeout ?? 60_000,
        message:
          opcoes.descricao ??
          "o elemento nao hidratou: o clique viraria no-op silencioso",
      }
    )
    .toBe(true)
}

/** Atalho: espera o `body` da página estar sob controle do React. */
export async function esperarApp(page: Page, timeout?: number): Promise<void> {
  await esperarHidratacao(page.locator("body"), {
    timeout,
    descricao: "a aplicacao nao hidratou nesta pagina",
  })
}
