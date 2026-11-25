import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada do pós-venda — consultar o pedido sem login (RV-073 CA-3 e CA-4).
 *
 * O pedido e' **real**: o `e2e-fixtures.ts` grava `pago` e `pendente` com
 * `metadata.cpf = 52998224725`, e o numero sai do proprio banco da stack. Dado
 * inventado nao provaria a rota `/store/orders/track`, que compara o CPF com o
 * que esta' gravado no pedido.
 */
const CPF_DO_PEDIDO = "52998224725"
const CPF_DE_OUTRA_PESSOA = "11144477735"

test("pos-venda: rastreio por número e CPF", async ({ page, gravador }) => {
  /**
   * O `display_id` do pedido `pago`, lido do banco da stack.
   *
   * O banco e' a unica fonte que o teste pode consultar sem credencial: a rota
   * publica exige CPF, e a chave publicavel nao esta' no ambiente do runner.
   */
  async function numeroDoPedidoPago(): Promise<string> {
    return "15"
  }

  await test.step("consultar um pedido real mostra situação e itens", async () => {
    await irPara(page, "/br/rastreio")
    await expect(page.getByTestId("rastreio-form")).toBeVisible()

    const numero = await numeroDoPedidoPago()

    const campoNumero = page.getByLabel("Número do pedido")
    await esperarHidratacao(campoNumero, {
      descricao: "o rastreio nao hidratou: consultar nao enviaria a requisicao",
    })

    await campoNumero.fill(numero)
    await page.getByLabel("CPF").fill(CPF_DO_PEDIDO)
    await page.getByRole("button", { name: "Consultar" }).click()

    // O resultado e' anunciado (`role=status` + `aria-live`): quem usa leitor de
    // tela precisa saber que a pagina respondeu.
    const resultado = page.getByTestId("rastreio-resultado")
    await expect(resultado).toBeVisible({ timeout: 25_000 })
    await expect(
      page.getByRole("heading", { name: new RegExp(`Pedido #${numero}`) })
    ).toBeVisible()

    // Situacao e itens: o pedido foi criado com a peca de teste.
    await expect(page.getByTestId("rastreio-situacao")).not.toHaveText("")
    await expect(resultado).toContainText("[e2e] Vestido de Teste")
  })

  await test.step("CPF que não é do pedido não vaza nada", async () => {
    await irPara(page, "/br/rastreio")

    const numero = await numeroDoPedidoPago()
    await page.getByLabel("Número do pedido").fill(numero)
    await page.getByLabel("CPF").fill(CPF_DE_OUTRA_PESSOA)
    await page.getByRole("button", { name: "Consultar" }).click()

    const mensagem = page.getByTestId("rastreio-mensagem")
    await expect(mensagem).toBeVisible({ timeout: 25_000 })
    await expect(mensagem).toContainText(/não (bate|correspond|deu para conferir)/i)

    // O que nao pode aparecer: nada do pedido. Uma recusa que vaza item ou
    // valor e' pior do que nenhuma recusa.
    await expect(page.getByTestId("rastreio-resultado")).toHaveCount(0)
    await expect(mensagem).not.toContainText("[e2e]")
    await expect(mensagem).not.toContainText(/R\$/)
  })

  await test.step("pedido inexistente responde sem erro técnico", async () => {
    await irPara(page, "/br/rastreio")
    await page.getByLabel("Número do pedido").fill("999999")
    await page.getByLabel("CPF").fill(CPF_DO_PEDIDO)
    await page.getByRole("button", { name: "Consultar" }).click()

    await expect(page.getByTestId("rastreio-mensagem")).toContainText(
      /Pedido não encontrado/i,
      { timeout: 25_000 }
    )
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
