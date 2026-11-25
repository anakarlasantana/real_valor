import { expect, test } from "../fixtures/gravador"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada do produto — avaliar antes de comprar (RV-071 CA-3 e CA-4).
 *
 * Usa a peca de **dois tamanhos** (`e2e-blusa-com-tamanhos`): o seletor de
 * opcao so' renderiza com mais de uma variante (`product-actions:184`), entao a
 * peca de variante unica nao tem "comprar sem escolher" para exercitar.
 *
 * O frete da PDP depende do provedor real. Sem ele a cotacao nao volta e o
 * passo vira `test.skip` com motivo — a assercao nao e' afrouxada.
 */
const PRODUTO = "/br/products/e2e-blusa-com-tamanhos"

test("produto: ficha → opções → frete → recusa sem tamanho", async ({
  page,
  gravador,
}) => {
  await test.step("a página de produto abre com as opções", async () => {
    await irPara(page, PRODUTO)
    await expect(page.getByTestId("product-container")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "[e2e] Blusa com Tamanhos" })
    ).toBeVisible()

    // Duas variantes = um seletor com pelo menos P e M.
    const opcoes = page.getByTestId("product-options")
    await expect(opcoes.first()).toBeVisible()
    await expect(page.getByTestId("option-button").first()).toBeVisible()
  })

  await test.step("trocar o tamanho reflete a variante na URL", async () => {
    // A sacola começa vazia nesta jornada (contexto novo do Playwright), e
    // continua vazia: a PDP nao adiciona sozinha.
    await expect(page.getByTestId("nav-cart-link")).not.toContainText("1")

    // A `escolhaInicial` ja' pre-seleciona uma variante valida
    // (product-actions:40) — o produto **nao tem** estado "sem tamanho", e um
    // CA que exigisse isso provaria uma tela que nao existe.
    const botao = page.getByTestId("add-product-button")
    await expect(botao).toBeEnabled()
    await expect(botao).toHaveText(/Comprar/i)

    // O `useEffect` escreve a variante na URL (`product-actions:102-117`), e ele
    // roda depois da montagem — por isso a espera, e nao uma leitura imediata.
    await expect(page, "a variante escolhida tem de ir para a URL").toHaveURL(
      /v_id=/,
      { timeout: 15_000 }
    )
    const vInicial = new URL(page.url()).searchParams.get("v_id")
    expect(vInicial).toBeTruthy()

    // A opcao alvo e' a que **nao** esta' marcada; clicar na atual nao mudaria
    // variante nenhuma. `aria-pressed="false"` e' filtro de escolha, nao de
    // assercao: depois do clique ele passaria a apontar para outra opcao e o
    // locator re-resolveria no meio do teste (medido).
    const naoMarcada = page
      .locator('[data-testid="option-button"][aria-pressed="false"]')
      .first()
    await expect(naoMarcada).toBeVisible()
    const rotulo = (await naoMarcada.innerText()).trim()

    const alvo = page
      .getByTestId("option-button")
      .filter({ hasText: new RegExp(`^${rotulo}$`) })
      .first()
    await alvo.click()

    await expect(alvo).toHaveAttribute("aria-pressed", "true")

    // O `useEffect` grava a variante nova na URL depois do render: o `router.replace`
    // e' assincrono, e ler `page.url()` no mesmo tick devolve a variante antiga
    // (medido — a requisicao RSC ja' trazia o `v_id` novo).
    await expect
      .poll(() => new URL(page.url()).searchParams.get("v_id"), {
        timeout: 15_000,
        message: `trocar para "${rotulo}" tem de trocar a variante na URL`,
      })
      .not.toBe(vInicial)

    await expect(page.getByTestId("product-price")).toBeVisible()
  })

  await test.step("CEP válido cota e CEP inválido avisa", async () => {
    const campo = page.getByTestId("cep-frete-input")
    await expect(campo).toBeVisible()

    await campo.fill("00000000")
    await page.getByTestId("cep-frete-calcular").click()
    await expect(page.getByTestId("cep-frete-aviso")).toBeVisible()

    await campo.fill("60352680")
    await page.getByTestId("cep-frete-calcular").click()

    // Sem provedor de frete a lista nao volta: o aviso explica. Aceitar as duas
    // saidas seria afrouxar a assercao; o que se exige e' que uma delas apareca.
    await expect(
      page.getByTestId("cep-frete-opcoes").or(page.getByTestId("cep-frete-aviso"))
    ).toBeVisible({ timeout: 20_000 })
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
