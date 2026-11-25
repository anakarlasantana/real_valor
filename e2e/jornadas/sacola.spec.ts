import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada da sacola — o estado que o checkout consome (RV-072 CA-1 e CA-2).
 *
 * A peca `[e2e]` tem variante unica, entao a PDP ja' vem resolvida e o
 * `add-product-button` esta' habilitado de cara. O passo que importa aqui nao e'
 * adicionar: e' o que a sacola faz **depois** — quantidade, total e remocao.
 */
const PRODUTO = "/br/products/e2e-vestido-de-teste"

/** Adiciona a peca pela PDP e espera o cabecalho refletir, como a cliente ve'. */
async function adicionarPeca(page: import("@playwright/test").Page) {
  await irPara(page, PRODUTO)

  const botao = page.getByTestId("add-product-button")
  await expect(botao).toBeVisible()
  await esperarHidratacao(botao, {
    descricao: "a PDP nao hidratou: o clique em Comprar nao dispararia a Server Action",
  })

  // A acao dispara refresh do router; sair antes de o contador mudar aborta a
  // navegacao (RW-2026-001). O contador e' o sinal que a cliente usa.
  await botao.click()
  await expect(page.getByTestId("nav-cart-link")).toContainText("1", {
    timeout: 20_000,
  })
}

test("sacola: adicionar → quantidade → total → remover", async ({
  page,
  gravador,
}) => {
  await test.step("a sacola começa vazia", async () => {
    await irPara(page, "/br/cart")
    await expect(page.getByTestId("cart-container")).toBeVisible()
    await expect(page.getByTestId("empty-cart-message")).toBeVisible()
  })

  await test.step("aumentar e diminuir a quantidade ajusta o total", async () => {
    await adicionarPeca(page)
    await irPara(page, "/br/cart")

    const linha = page.getByTestId("product-row")
    await expect(linha).toBeVisible()
    await expect(page.getByTestId("empty-cart-message")).toHaveCount(0)

    const quantidade = page.getByTestId("product-quantity")
    const total = page.getByTestId("cart-total")
    await expect(quantidade).toHaveText("1")

    const totalComUm = await total.innerText()

    const aumentar = page.getByTestId("product-increase-button")
    await esperarHidratacao(aumentar, {
      descricao: "a sacola nao hidratou: mudar a quantidade nao refletiria no total",
    })
    await aumentar.click()

    await expect(quantidade).toHaveText("2", { timeout: 20_000 })
    await expect(total).not.toHaveText(totalComUm)

    const totalComDois = await total.innerText()

    await page.getByTestId("product-decrease-button").click()
    await expect(quantidade).toHaveText("1", { timeout: 20_000 })
    await expect(total).toHaveText(totalComUm)

    expect(totalComDois, "duas pecas custam mais que uma").not.toBe(totalComUm)
  })

  await test.step("remover o item devolve o estado vazio", async () => {
    await page.getByTestId("product-delete-button").click()

    // O estado vazio e' a resposta: uma lista em branco sem mensagem deixaria a
    // cliente sem saber se o item saiu ou se a pagina quebrou.
    await expect(page.getByTestId("empty-cart-message")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId("product-row")).toHaveCount(0)
  })

  await test.step("evidência: sem 5xx e sem erro de console", async () => {
    const cincoXX = gravador.rede.filter((linha) => linha.status >= 500)
    const errosDeConsole = gravador.console.filter(
      (linha) =>
        linha.tipo === "pageerror" ||
        (linha.nivel === "error" && !linha.texto.includes("net::ERR_ABORTED"))
    )

    expect(cincoXX, `5xx na jornada: ${JSON.stringify(cincoXX)}`).toEqual([])
    expect(
      errosDeConsole,
      `erros no console: ${JSON.stringify(errosDeConsole)}`
    ).toEqual([])
  })
})
