import type { Page } from "@playwright/test"

/**
 * Navegação com segunda tentativa.
 *
 * O `next dev` compila sob demanda e a ação de adicionar dispara refresh do
 * router: um `goto` em cima disso volta `net::ERR_ABORTED` (RW-2026-003). Não é
 * retry de asserção — é a navegação em si, e o alvo é o mesmo.
 *
 * O caminho vai relativo de propósito: o Playwright resolve contra o `baseURL`
 * do projeto, então a loja (`:8100`) e o painel (`:9100`) continuam em hosts
 * diferentes sem este helper precisar saber qual é qual.
 */
export async function irPara(
  page: Page,
  caminho: string,
  opcoes: { timeout?: number } = {}
): Promise<void> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await page.goto(caminho, { waitUntil: "domcontentloaded", ...opcoes })
      return
    } catch (erro) {
      if (tentativa === 2) throw erro
    }
  }
}
