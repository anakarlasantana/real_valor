import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada do checkout — o dinheiro (RV-073 CA-1 e CA-2).
 *
 * **A jornada para na fronteira do pagamento.** Fechar o pedido exige provedor
 * real, e a loja filtra o `pp_system_default` (que "paga" sem cobrar); apertar
 * "pagar" sem provedor seria provar uma mentira. O `e2e:mp` cobre o PIX em modo
 * teste, e esta' declarado fora do escopo do doc 20 §20.7.
 *
 * O endereco e o CPF sao os mesmos da `cliente.spec`, e o CPF e' obrigatorio
 * nesta loja: a etiqueta de envio sai com ele.
 */
const PRODUTO = "/br/products/e2e-vestido-de-teste"

/** Preenche um campo que pode ser `<select>` (pais/UF) ou texto. */
async function preencher(page: Page, testid: string, valor: string) {
  const campo = page.getByTestId(testid)
  const ehSelect = await campo.evaluate((el) => el.tagName === "SELECT")
  if (ehSelect) await campo.selectOption(valor)
  else await campo.fill(valor)
}

/** Leva a sacola ate' o checkout com um item, como a cliente faz. */
async function comPecaNaSacola(page: Page) {
  await irPara(page, PRODUTO)
  const botao = page.getByTestId("add-product-button")
  await esperarHidratacao(botao, {
    descricao: "a PDP nao hidratou: o clique em Comprar nao dispararia a Server Action",
  })
  await botao.click()
  await expect(page.getByTestId("nav-cart-link")).toContainText("1", {
    timeout: 20_000,
  })
}

test("checkout: endereço → entrega → pagamento → revisão", async ({
  page,
  gravador,
}) => {
  await test.step("endereço é aceito e libera a entrega", async () => {
    await comPecaNaSacola(page)
    await irPara(page, "/br/checkout?step=address")

    // Carrinho perdido abre `empty-state` e nao existe campo para preencher:
    // falhar aqui (e nao no primeiro `fill`) e' o que da' nome ao defeito.
    await expect(page.getByTestId("checkout-container")).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.getByTestId("empty-state"),
      "o checkout abriu vazio: o carrinho nao sobreviveu ao add-to-cart"
    ).toHaveCount(0)

    // O formulario de endereco precisa estar sob controle do React: preencher
    // antes da hidratacao deixa o `onSubmit` sem handler e o clique vira no-op —
    // a tela continua em "Informe o endereco acima" (medido na suite).
    await esperarHidratacao(page.getByTestId("shipping-email-input"), {
      descricao: "o formulario de endereco nao hidratou: continuar nao enviaria nada",
    })

    await preencher(page, "shipping-email-input", "cliente@e2e.realvalor.test")
    await preencher(page, "shipping-first-name-input", "Cliente")
    await preencher(page, "shipping-last-name-input", "De Teste")
    await preencher(page, "shipping-phone-input", "85999990000")
    await preencher(page, "shipping-cpf-input", "52998224725")
    await preencher(page, "shipping-postal-code-input", "60352680")

    // O CEP dispara a busca de endereco; preencher o resto antes dela voltar
    // deixa o formulario pela metade.
    await page
      .getByTestId("shipping-cep-buscando")
      .waitFor({ state: "detached", timeout: 10_000 })
      .catch(() => null)

    await preencher(page, "shipping-address-number-input", "388")
    await preencher(page, "shipping-neighborhood-input", "Alvaro Weyne")
    await preencher(page, "shipping-city-input", "Fortaleza")
    await preencher(page, "shipping-province-input", "CE")

    const enviar = page.getByTestId("submit-address-button")
    await esperarHidratacao(enviar, {
      descricao: "o endereco nao hidratou: o clique em continuar viraria no-op",
    })
    await enviar.click()

    // O endereco aceito avanca o checkout: a etapa "Entrega" ja' aparece cotada
    // e escolhida (`PAC · R$ 22,28`). O `delivery-options-container` so' existe
    // enquanto o grupo esta' aberto para edicao — esperar por ele no estado
    // fechado e' esperar um elemento que o fluxo nao mostra (medido).
    await expect(page.getByTestId("shipping-address-summary")).toBeVisible({
      timeout: 25_000,
    })
  })

  await test.step("a entrega cota e é aceita", async () => {
    // Cada transportadora que respondeu vira uma opcao com preco e prazo: o
    // texto do radio e' a prova de que a cotacao voltou (`PAC até 5 dias úteis
    // R$ 22,28`). A indisponivel aparece `disabled` — nao some, e' o que diz
    // "a loja nao atende esse caso".
    const opcoes = page.getByTestId("delivery-option-radio")
    await expect(opcoes.first()).toBeVisible({ timeout: 25_000 })

    const cotada = page.getByRole("radio", { name: /R\$\s?\d/ })
    await expect(cotada.first()).toBeVisible()
    await expect(page.getByRole("radio", { name: /indispon/i }).first()).toBeDisabled()

    // Escolher e confirmar e' o gesto da cliente; o clique e' Server Action.
    await cotada.first().check()

    const avancou = page
      .waitForResponse((r) => r.request().method() === "POST", { timeout: 20_000 })
      .catch(() => null)
    await page.getByTestId("submit-delivery-option-button").click()
    await avancou
  })

  await test.step("só os meios reais de pagamento aparecem", async () => {
    const rotulos = page.getByTestId("payment-option-label")
    await expect(rotulos).toHaveCount(2, { timeout: 25_000 })

    // O meio manual do Medusa "paga" sem cobrar e e' filtrado na loja: se ele
    // aparecer, a cliente fecha compra sem pagar.
    expect(
      (await rotulos.allTextContents()).map((r) => r.trim()).sort()
    ).toEqual(["Cartão de crédito", "Pix"])
  })

  await test.step("a revisão mostra endereço, entrega e total", async () => {
    // Os resumos sao os do **checkout** (`addresses/index.tsx`): o
    // `shipping-method-summary` e' da tela de pedido, nao daqui.
    await expect(page.getByTestId("shipping-address-summary")).toBeVisible()
    await expect(page.getByTestId("shipping-contact-summary")).toBeVisible()

    // O botao de pagar so' habilita com um meio escolhido — e' a regra do
    // componente (`payment/index.tsx:244`), e o rotulo dele e' "Continuar para
    // a revisao". Escolher o Pix e' o gesto que a cliente faz.
    const pagar = page.getByTestId("submit-payment-button")
    await expect(pagar).toBeVisible()
    await expect(pagar).toBeDisabled()

    await page
      .getByRole("radio", { name: /Pix/i })
      .check()
    await expect(pagar).toBeEnabled()

    // O total e' o numero que a cliente confere antes de pagar; vazio ou zero
    // seria a tela mentindo. Ele esta' no resumo, ao lado da sacola.
    const total = page.getByTestId("cart-total")
    await expect(total).toBeVisible()
    await expect(total).toContainText(/R\$\s?\d/)

    // O clique NAO e' dado: para ai' a fronteira (provedor real e' do `e2e:mp`).
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
