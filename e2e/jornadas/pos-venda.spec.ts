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

/** A API do stack em teste: a de produção quando o `perf` está no ar. */
const API = process.env.E2E_API_URL ?? "http://localhost:9100"

test("pos-venda: rastreio por número e CPF", async ({ page, gravador }) => {
  /**
   * O `display_id` do pedido `pago` do fixture, descoberto na propria pilha.
   *
   * O numero **nao e' fixo**: `display_id` e' sequencial por base, entao no
   * `rv_e2e` o pedido pago podia ser 15 e no `rv_perf` ele e' 1 — o literal
   * `"15"` fazia a jornada falhar em toda base nova. O e-mail do fixture e'
   * deterministico (`lojista-pago@realvalor.test`), e a rota publica aceita
   * e-mail: e' por ele que o numero e' descoberto.
   */
  async function numeroDoPedidoPago(): Promise<string> {
    // A chave publicavel e' POR STACK (cada banco sorteia a sua): a do `.env` e'
    // a de dev e responde `not_allowed` aqui. Quem roda a jornada passa
    // `E2E_PK` com a chave da base em teste (`make e2e-*` e `make perf` fazem
    // isso). Sem ela a descoberta nao tem como funcionar, e a mensagem diz.
    const chave = process.env.E2E_PK

    if (!chave) {
      throw new Error(
        "E2E_PK ausente: a chave publicavel e' por stack e a descoberta do pedido " +
          "precisa da chave da base em teste. Rode por `make e2e-pos-venda` ou `make perf`."
      )
    }

    for (let n = 1; n <= 100; n++) {
      const resposta = await page.request.get(
        `${API}/store/orders/track?display_id=${n}&email=lojista-pago@realvalor.test`,
        { headers: { "x-publishable-api-key": chave } }
      )
      if (!resposta.ok()) continue

      const corpo = (await resposta.json()) as { order?: { display_id?: number } }
      if (corpo.order?.display_id) return String(corpo.order.display_id)
    }

    throw new Error(
      "nenhum pedido do fixture 'pago' foi encontrado: rode `yarn e2e:fixtures` nesta stack"
    )
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
    //
    // Dois estados sao legítimos e a tela distingue os dois: **encontrado**
    // (o painel ja' gravou o codigo) e **pendente** (o pedido existe e a
    // transportadora ainda nao foi registrada). Exigir so' o primeiro provaria
    // uma tela que depende de dado que a stack pode nao ter — e foi o que
    // aconteceu no `rv_perf`, onde o pedido nao tem `tracking_number`.
    const resultado = page.getByTestId("rastreio-resultado")
    const pendente = page.getByTestId("rastreio-mensagem")

    await expect(resultado.or(pendente)).toBeVisible({ timeout: 25_000 })

    if (await resultado.isVisible().catch(() => false)) {
      await expect(
        page.getByRole("heading", { name: new RegExp(`Pedido #${numero}`) })
      ).toBeVisible()
      await expect(page.getByTestId("rastreio-situacao")).not.toHaveText("")
      await expect(resultado).toContainText("[e2e]")
    } else {
      // Sem codigo, a tela diz que o pedido foi recebido — e nao um formulario
      // vazio, que faria a cliente pensar que digitou errado.
      await expect(pendente).toContainText(/Pedido recebido/i)
    }
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
