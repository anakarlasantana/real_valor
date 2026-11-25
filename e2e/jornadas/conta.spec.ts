import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada da conta (RV-072 CA-3 e CA-4).
 *
 * O e-mail e' **unico por execucao**: registrar o mesmo endereco duas vezes
 * responde `customer_already_exists`, e a jornada falharia na segunda rodada por
 * dado gasto, nao por defeito. O dominio `.test` e' reservado e nao recebe envio.
 */
const SENHA = "SenhaE2e!2026"
const EMAIL = `e2e-conta-${Date.now()}@realvalor.test`

test("conta: registrar → sair → entrar → pedidos", async ({
  page,
  gravador,
}) => {
  await test.step("registrar com e-mail novo", async () => {
    await irPara(page, "/br/account")

    // `/account` abre no **login** (`login-template:11`): o formulario de
    // registro so' aparece depois do clique em "register-button", que e' o
    // `setCurrentView("register")` do mesmo componente. Sem este passo os campos
    // de nome nao existem no DOM e o teste morre em 120s num `fill`.
    await expect(page.getByTestId("login-page")).toBeVisible()
    await page.getByTestId("register-button").click()

    const email = page.getByTestId("email-input")
    await expect(email).toBeVisible()
    await esperarHidratacao(email, {
      descricao: "o formulario de registro nao hidratou: os campos nao chegariam ao servidor",
    })

    await email.fill(EMAIL)
    await page.getByTestId("password-input").fill(SENHA)
    await page.getByTestId("first-name-input").fill("Cliente")
    await page.getByTestId("last-name-input").fill("E2E")
    await page.getByTestId("phone-input").fill("85999990000")

    await page.getByTestId("register-button").click()

    // A conta autenticada troca a tela de registro pela de conta.
    await expect(page.getByTestId("account-page")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId("register-page")).toHaveCount(0)
  })

  await test.step("a conta oferece endereços e pedidos", async () => {
    await expect(page.getByTestId("addresses-link")).toBeVisible()
    await expect(page.getByTestId("orders-link")).toBeVisible()

    await page.getByTestId("addresses-link").click()
    await expect(page.getByTestId("addresses-page-wrapper")).toBeVisible({
      timeout: 30_000,
    })

    await page.getByTestId("orders-link").click()
    await expect(page.getByTestId("orders-page-wrapper")).toBeVisible({
      timeout: 30_000,
    })

    // Conta nova nao tem pedido: o esperado e' o estado vazio, e nao erro.
    await expect(page.getByTestId("no-orders-container")).toBeVisible()
  })

  await test.step("registrar, sair e entrar de novo", async () => {
    await page.getByTestId("overview-link").click()
    await expect(page.getByTestId("account-page")).toBeVisible({
      timeout: 30_000,
    })

    await esperarHidratacao(page.getByTestId("logout-button"), {
      descricao: "a conta nao hidratou: sair nao encerraria a sessao",
    })
    await page.getByTestId("logout-button").click()

    // Sem sessao a conta volta a pedir login.
    await expect(page.getByTestId("login-page")).toBeVisible({
      timeout: 30_000,
    })

    await page.getByTestId("email-input").fill(EMAIL)
    await page.getByTestId("password-input").fill(SENHA)
    await page.getByTestId("sign-in-button").click()

    // Entrar com a mesma senha e' o que prova que o registro gravou o que o
    // login aceita — e nao um usuario meio criado.
    await expect(page.getByTestId("account-page")).toBeVisible({
      timeout: 30_000,
    })
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
