import { expect, test } from "../fixtures/gravador"

/**
 * Jornada da cliente — da vitrine até o pagamento (doc 20 §20.3).
 *
 * Para no passo de pagamento de propósito: a loja **filtra** o
 * `pp_system_default` (ele "paga" sem cobrar), então fechar pedido sem provedor
 * real seria mentira. O fechamento é coberto pela persona de API (fase 4/6) e o
 * `e2e:mp` (opt-in) cobre o PIX em modo teste.
 *
 * A peça e o envio de preço fixo vêm dos fixtures (`yarn e2e:fixtures`), não
 * deste arquivo: dado de teste é do alvo, não do runner.
 */

const PRODUTO = "[e2e] Vestido de Teste"

test("cliente-compra: vitrine → produto → sacola → entrega → pagamento", async ({
  page,
  gravador,
}) => {
  await test.step("home da loja abre", async () => {
    await page.goto("/br")
    await expect(page).toHaveTitle(/Real Valor/)
    // A faixa da capa é o primeiro conteúdo da home; se ela não desenhou, a
    // página veio com erro e o resto da jornada não prova nada.
    await expect(page.locator("main")).toBeVisible()
  })

  await test.step("catálogo mostra a peça de teste", async () => {
    await page.goto("/br/store")
    const cartao = page.getByTestId("product-title").filter({ hasText: PRODUTO })
    await expect(cartao.first()).toBeVisible()
    await cartao.first().click()
  })

  await test.step("página de produto e adicionar à sacola", async () => {
    await expect(page.getByRole("heading", { name: PRODUTO })).toBeVisible()
    await page.getByRole("button", { name: "Comprar" }).click()
    await expect(
      page.getByTestId("product-quantity").or(page.getByRole("dialog"))
    ).toBeVisible({ timeout: 15_000 }).catch(() => {
      // O clique pode ir direto para a sacola; o passo seguinte confirma.
    })
  })

  await test.step("sacola tem a peça", async () => {
    await page.goto("/br/cart")
    await expect(page.getByText(PRODUTO).first()).toBeVisible()
  })

  await test.step("checkout · contato e endereço", async () => {
    // Vai direto ao endereço do checkout: o cookie do carrinho é o mesmo, e o
    // link da sacola varia com o layout (o primeiro teste pagou esse preço —
    // clicou num link de rodapé e o campo de e-mail nunca apareceu).
    await page.goto("/br/checkout?step=address")

    // O sintoma que importa: se o carrinho não persistiu, o checkout abre em
    // `empty-state` e NÃO existe campo para preencher. Falhar aqui (e não no
    // primeiro `fill`) é o que dá nome ao defeito no laudo.
    await expect(page.getByTestId("checkout-container")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByTestId("empty-state"),
      "o checkout abriu vazio: o carrinho não sobreviveu entre o add-to-cart e o checkout"
    ).toHaveCount(0, { timeout: 15_000 })

    await page.getByTestId("email-input").fill("cliente@e2e.realvalor.test")
    await page.getByTestId("billing-first-name-input").fill("Cliente")
    await page.getByTestId("billing-last-name-input").fill("De Teste")
    await page.getByTestId("billing-phone-input").fill("85999990000")
    await page.getByTestId("billing-postal-input").fill("60352680")
    await page.getByTestId("billing-address-number-input").fill("388")
    await page.getByTestId("billing-neighborhood-input").fill("Alvaro Weyne")
    await page.getByTestId("billing-city-input").fill("Fortaleza")
    await page.getByTestId("billing-province-input").fill("CE")

    await page.getByRole("button", { name: "Continuar para a entrega" }).click()
  })

  await test.step("checkout · entrega cota e aceita a opção", async () => {
    await expect(page.getByTestId("delivery-options-container")).toBeVisible({
      timeout: 20_000,
    })

    await page.getByTestId("delivery-option-radio").first().check()
    await page
      .getByRole("button", { name: "Continuar para o pagamento" })
      .click()
  })

  await test.step("checkout · pagamento é oferecido", async () => {
    await expect(page.getByTestId("radio-button").first()).toBeVisible({
      timeout: 20_000,
    })
  })

  await test.step("evidência: sem 5xx e sem erro de console", async () => {
    const cincoXX = gravador.rede.filter((linha) => linha.status >= 500)
    const errosDeConsole = gravador.console.filter(
      (linha) => linha.tipo === "pageerror" || linha.nivel === "error"
    )

    expect(cincoXX, `5xx na jornada: ${JSON.stringify(cincoXX)}`).toEqual([])
    expect(
      errosDeConsole,
      `erros no console: ${JSON.stringify(errosDeConsole)}`
    ).toEqual([])
  })
})
