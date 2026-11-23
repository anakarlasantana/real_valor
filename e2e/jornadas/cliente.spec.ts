import type { Page } from "@playwright/test"

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

/**
 * Navegação com segunda tentativa.
 *
 * O `next dev` compila sob demanda e a ação de adicionar dispara refresh do
 * router: um `goto` em cima disso volta `net::ERR_ABORTED` (RW-2026-003). Não é
 * retry de asserção — é a navegação em si, e o alvo é o mesmo.
 */
async function irPara(page: Page, caminho: string): Promise<void> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await page.goto(caminho, { waitUntil: "domcontentloaded" })
      return
    } catch (erro) {
      if (tentativa === 2) throw erro
    }
  }
}

test("cliente-compra: vitrine → produto → sacola → entrega → pagamento", async ({
  page,
  gravador,
}) => {
  await test.step("home da loja abre", async () => {
    await irPara(page, "/br")
    await expect(page).toHaveTitle(/Real Valor/)
    // A faixa da capa é o primeiro conteúdo da home; se ela não desenhou, a
    // página veio com erro e o resto da jornada não prova nada.
    await expect(page.locator("main").first()).toBeVisible()
  })

  await test.step("catálogo mostra a peça de teste", async () => {
    await irPara(page, "/br/store")
    const cartao = page.getByTestId("product-title").filter({ hasText: PRODUTO })
    await expect(cartao.first()).toBeVisible()
    await cartao.first().click()
  })

  await test.step("página de produto e adicionar à sacola", async () => {
    await expect(page.getByRole("heading", { name: PRODUTO })).toBeVisible()

    // Adicionar é uma Server Action (POST na própria página). Dois cuidados que
    // a primeira versão não tinha (RW-2026-001):
    //   1. navegar logo após o clique ABORTA o POST — e com ele o `Set-Cookie`;
    //   2. o clique pode cair ANTES da hidratação e virar no-op silencioso.
    // Por isso esperamos a resposta da ação e, se ela não veio, clicamos de novo.
    const botaoComprar = page.getByTestId("add-product-button")
    await expect(botaoComprar).toBeEnabled({ timeout: 20_000 })

    let adicionou = false

    for (let tentativa = 1; tentativa <= 3 && !adicionou; tentativa++) {
      const acao = page
        .waitForResponse((resposta) => resposta.request().method() === "POST", {
          timeout: 6_000,
        })
        .catch(() => null)

      await botaoComprar.click()
      adicionou = Boolean(await acao)
    }

    expect(
      adicionou,
      "o clique em Comprar não disparou a Server Action (hidratação?)"
    ).toBe(true)

    // Espera o app refletir o item (o contador da sacola no cabeçalho) antes de
    // navegar: a ação dispara um refresh do router, e sair no meio ABORTA a
    // navegação (`net::ERR_ABORTED`). É o mesmo sinal que a pessoa usa.
    await expect(page.getByTestId("nav-cart-link")).toContainText("1", {
      timeout: 15_000,
    })
  })

  await test.step("sacola tem a peça", async () => {
    await irPara(page, "/br/cart")

    await expect(
      page.getByTestId("empty-state"),
      "a sacola abriu vazia — o carrinho não persistiu"
    ).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText(PRODUTO).first()).toBeVisible()
  })

  await test.step("checkout · contato e endereço", async () => {
    // Vai direto ao endereço do checkout: o cookie do carrinho é o mesmo, e o
    // link da sacola varia com o layout (o primeiro teste pagou esse preço —
    // clicou num link de rodapé e o campo de e-mail nunca apareceu).
    await irPara(page, "/br/checkout?step=address")

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

    // O passo de endereço usa os campos `shipping-*` (os `billing-*` são do
    // bloco de cobrança, que só existe quando é outro endereço).
    const preencher = async (testid: string, valor: string) => {
      const campo = page.getByTestId(testid)
      const ehSelect = await campo.evaluate((el) => el.tagName === "SELECT")

      if (ehSelect) {
        await campo.selectOption(valor)
      } else {
        await campo.fill(valor)
      }
    }

    await preencher("shipping-email-input", "cliente@e2e.realvalor.test")
    await preencher("shipping-first-name-input", "Cliente")
    await preencher("shipping-last-name-input", "De Teste")
    await preencher("shipping-phone-input", "85999990000")
    // O CPF é obrigatório no checkout desta loja (a etiqueta de envio sai com
    // ele); sem preencher, o passo de endereço não avança e a entrega nunca
    // aparece.
    await preencher("shipping-cpf-input", "52998224725")

    // O CEP dispara a busca de endereço (`shipping-cep-buscando`); preencher o
    // resto ANTES dela voltar deixa o formulário pela metade.
    await preencher("shipping-postal-code-input", "60352680")
    await page
      .getByTestId("shipping-cep-buscando")
      .waitFor({ state: "detached", timeout: 8_000 })
      .catch(() => {
        // A busca pode não existir nesta configuração; o preenchimento abaixo
        // vale de qualquer forma.
      })

    await preencher("shipping-address-number-input", "388")
    await preencher("shipping-neighborhood-input", "Alvaro Weyne")
    await preencher("shipping-city-input", "Fortaleza")
    await preencher("shipping-province-input", "CE")

    // O envio do endereço também é Server Action: o clique pode cair ANTES da
    // hidratação e virar no-op silencioso — o grupo "Entrega" então fica em
    // "Informe o endereço acima…" (medido em 17/11, RW-2026-008). Mesmo cuidado
    // do add-to-cart: espera a resposta e, se não veio, clica de novo.
    const enviarEndereco = page.getByTestId("submit-address-button")
    let enviou = false

    for (let tentativa = 1; tentativa <= 3 && !enviou; tentativa++) {
      const acao = page
        .waitForResponse((resposta) => resposta.request().method() === "POST", {
          timeout: 8_000,
        })
        .catch(() => null)

      await enviarEndereco.click()
      enviou = Boolean(await acao)
    }

    expect(
      enviou,
      "o clique em Continuar para a entrega não disparou a Server Action (hidratação?)"
    ).toBe(true)
  })

  await test.step("checkout · entrega cota e aceita a opção", async () => {
    await expect(page.getByTestId("delivery-options-container")).toBeVisible({
      timeout: 20_000,
    })

    await page.getByTestId("delivery-option-radio").first().check()

    // Este clique também é Server Action: sem esperar a resposta, o passo
    // seguinte sai com POST em voo e a navegação o aborta (net::ERR_ABORTED).
    const avancou = page
      .waitForResponse((resposta) => resposta.request().method() === "POST", {
        timeout: 15_000,
      })
      .catch(() => null)

    await page
      .getByRole("button", { name: "Continuar para o pagamento" })
      .click()

    await avancou
  })

  await test.step("checkout · pagamento é oferecido", async () => {
    const rotulos = page.getByTestId("payment-option-label")

    // `radio-button` também existe na entrega (shipping/index.tsx): usar o
    // primeiro da página assertava o frete e passava sem ver o pagamento.
    await expect(rotulos).toHaveCount(2, { timeout: 20_000 })

    // O meio manual do Medusa ("paga" sem cobrar) é filtrado na loja: se ele
    // aparecer na lista, a cliente fecha compra sem pagar.
    expect(
      (await rotulos.allTextContents()).map((rotulo) => rotulo.trim()).sort()
    ).toEqual(["Cartão de crédito", "Pix"])
  })

  await test.step("rastreio · consulta sem login mostra o resultado", async () => {
    // Ainda há POST do checkout em voo; navegar agora abortaria um deles.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null)
    await irPara(page, "/br/rastreio")
    await expect(
      page.getByRole("heading", { name: "Rastrear pedido" })
    ).toBeVisible()

    // Só teclado: foco no primeiro campo, Tab entre os três e Enter no botão —
    // é o caminho de quem não usa mouse (RV-044 CA-5).
    await page.getByLabel("Número do pedido").focus()
    await page.keyboard.type("999999")

    await page.keyboard.press("Tab")
    await expect(page.getByLabel("CPF")).toBeFocused()
    await page.keyboard.type("52998224725")

    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("button", { name: "Consultar" })
    ).toBeFocused()
    await page.keyboard.press("Enter")

    // Pedido inexistente de propósito: prova que a tela responde ao submit sem
    // login, sem vazar dado de outro pedido, e que o resultado é anunciado
    // (`role=status` + `aria-live`) em vez de a página ficar muda.
    await expect(page.getByRole("status")).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole("heading", { name: "Pedido não encontrado" })
    ).toBeVisible()
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
