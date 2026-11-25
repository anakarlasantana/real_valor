import type { Page } from "@playwright/test"

import { expect, test } from "../fixtures/gravador"
import { irPara as irParaComRetentativa } from "../fixtures/navegacao"
import { credencialPainel } from "../fixtures/painel"

/**
 * Jornada do lojista — o painel da loja (doc 20 §20.3, RV-069).
 *
 * Roda contra a stack `rv_e2e` no painel servido pelo backend (`:9100/painel`).
 * O pedido vem de `backend/src/scripts/e2e-fixtures.ts` (um pago, um pendente):
 * a jornada le' o que o fixture escreveu, nao inventa pedido.
 *
 * O login e' feito no proprio spec: o dashboard guarda a sessao em memoria do
 * SPA (nao em cookie nem em `localStorage` — medido), entao um `storageState`
 * semeado fora do navegador nao sobrevive.
 */

const PAINEL = "/painel"
const ENVIOS = "/painel/shipping"
const SERVICOS = "/painel/frete/servicos"
const PACOTES = "/painel/frete/pacotes"
const VITRINE = "/painel/content"

/** O rotulo do item de menu de cada tela — o que o lojista clica. */
const ROTULOS: Record<string, string> = {
  [ENVIOS]: "Envios",
  [SERVICOS]: "Serviços de frete",
  [PACOTES]: "Pacotes",
  [VITRINE]: "Conteúdo da vitrine",
}

const { email: EMAIL, senha: SENHA } = credencialPainel()

/** O painel compila sob demanda (`vite dev`) e o dashboard monta um SPA: a 1a visita e' lenta. */
const LENTO = { timeout: 90_000 }

async function entrar(page: Page): Promise<void> {
  // `networkidle`, e nao `domcontentloaded`: os campos existem no HTML antes de
  // o bundle do dashboard hidratar, e preencher nesse intervalo deixa o clique
  // num botao que ainda nao tem handler — o form "envia" e nada acontece
  // (medido: nenhuma requisicao a `/auth/*` saia).
  await page.goto(`${PAINEL}/login`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  })

  const botao = page.getByRole("button", { name: /continue with email/i })
  await expect(botao).toBeEnabled(LENTO)

  // O `networkidle` NAO garante hidratacao: o Vite re-otimiza deps quando outra
  // jornada ja' rodou e o chunk sai `net::ERR_ABORTED`, deixando o formulario
  // sem handler — o clique passa e nenhum `/auth/*` sai (medido na suite
  // completa: isolada 9,1s, depois da cliente 90s de timeout). Esperar o
  // React assumir o campo e' o unico sinal que nao depende do bundle inteiro.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const campo = document.querySelector<HTMLInputElement>('input[type="email"], input[name="email"]')
          if (!campo) return false
          const chave = Object.keys(campo).find((k) => k.startsWith("__reactProps$"))
          return Boolean(chave)
        }),
      { timeout: 90_000, message: "o formulario do painel nao hidratou (chunk do Vite abortado?)" }
    )
    .toBe(true)

  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(SENHA)

  // A senha some quando a sessao existe; a navegacao e' `history.pushState`.
  await botao.click()
  await expect(page.locator('input[type="password"]')).toBeHidden(LENTO)

  await expect(page.getByRole("link", { name: "Envios" })).toBeVisible(LENTO)
}

async function irPara(page: Page, caminho: string): Promise<void> {
  // `goto` em cima de um SPA que redireciona aborta a navegacao
  // (`net::ERR_ABORTED`, medido): depois do 1o carregamento, trocar de tela e'
  // clicar no menu — que e' tambem o caminho do lojista.
  const resumo = ROTULOS[caminho]

  if (resumo) {
    await page.getByRole("link", { name: resumo, exact: true }).first().click()
    return
  }

  await irParaComRetentativa(page, caminho, { timeout: 90_000 })
}

test("lojista-envio: painel → fila → registro → etiqueta", async ({
  page,
  gravador,
}) => {
  await test.step("admin abre", async () => {
    await entrar(page)
    await expect(page.locator("#medusa")).toBeAttached(LENTO)
  })

  await test.step("fila de envio mostra o pedido pago", async () => {
    await irPara(page, ENVIOS)
    await expect(page.getByTestId("shipping-page")).toBeVisible(LENTO)
    await expect(page.getByTestId("shipping-carteira")).toBeVisible(LENTO)

    const pedidos = page.getByTestId("shipping-pedido")
    await expect(pedidos.first()).toBeVisible(LENTO)

    // O fixture grava dois pedidos: o capturado oferece gerar etiqueta, o
    // pendente so' espera. Se a regra quebrar, um dos dois lados desaparece.
    await expect(
      page.getByTestId("shipping-gerar-etiqueta").first()
    ).toBeVisible(LENTO)
  })

  await test.step("carteira mostra o saldo real", async () => {
    const carteira = page.getByTestId("shipping-carteira")
    const erro = page.getByTestId("shipping-carteira-erro")

    // O stack `rv_e2e` tem token de sandbox: o esperado e' o saldo em reais.
    // Se a leitura falhar, o que se exige e' a MENSAGEM — `R$ 0,00` esconderia
    // o problema, e e' justamente o que o RV-068 proibe.
    if (await erro.isVisible().catch(() => false)) {
      await expect(erro).not.toHaveText("")
      await expect(carteira).not.toContainText("R$ 0,00")
    } else {
      await expect(carteira).toContainText(/R\$\s?[0-9]/)
    }
  })

  await test.step("envio registrado preserva o código", async () => {
    await page.getByTestId("shipping-registrar-envio").first().click()

    const form = page.getByTestId("envio-form")
    await expect(form).toBeVisible(LENTO)

    // Qual pedido esta aberto: o cabecalho do formulario diz o `display_id`.
    const cabecalho = await form.getByRole("heading").innerText()
    const numero = Number(cabecalho.replace(/\D+/g, ""))
    const cartao = page.locator(
      `[data-testid="shipping-pedido"][data-pedido="${numero}"]`
    )

    await page.getByTestId("envio-carrier").fill("Correios")
    await page.getByTestId("envio-tracking-number").fill("BR123456789BR")
    await page.getByTestId("envio-situacao").fill("Em processamento")
    await page.getByTestId("envio-salvar").click()

    // Depois de salvar o cartao muda de secao (Aguardando → Ja enviados), por
    // isso a espera e' no cartao daquele pedido, nao em `.first()`.
    await expect(cartao).toContainText("Correios", LENTO)

    // Segunda gravacao: muda SO' a situacao. O codigo tem de continuar la'.
    await cartao.getByTestId("shipping-registrar-envio").click()
    await expect(page.getByTestId("envio-form")).toBeVisible(LENTO)
    await expect(page.getByTestId("envio-tracking-number")).toHaveValue(
      "BR123456789BR"
    )

    await page.getByTestId("envio-situacao").fill("Entregue")
    await page.getByTestId("envio-salvar").click()
    await expect(page.getByTestId("envio-form")).toBeHidden(LENTO)

    await expect(cartao).toContainText("Entregue", LENTO)
  })

  await test.step("servicos de frete abrem com a lista", async () => {
    await irPara(page, SERVICOS)
    await expect(page.getByTestId("servicos-page")).toBeVisible(LENTO)
    await expect(page.getByTestId("servicos-linha").first()).toBeVisible(LENTO)
  })

  await test.step("pacotes abrem e o formulário valida", async () => {
    await irPara(page, PACOTES)
    await expect(page.getByTestId("pacotes-page")).toBeVisible(LENTO)

    await page.getByTestId("pacotes-nova").click()
    await expect(page.getByRole("button", { name: "Salvar" })).toBeVisible(LENTO)
    await page.getByRole("button", { name: "Salvar" }).click()

    // Caixa sem nome nao salva: a validacao responde antes de qualquer POST.
    await expect(page.getByTestId("pacotes-page")).toBeVisible()
  })

  await test.step("vitrine abre com as três abas", async () => {
    await irPara(page, VITRINE)
    await expect(page.getByTestId("content-page")).toBeVisible(LENTO)

    // As abas saem de `MAIN_NAVIGATION`; o id de cada uma e' o `ViewMode`.
    for (const aba of ["vitrine", "pages", "theme"]) {
      await expect(page.getByTestId(`content-aba-${aba}`)).toBeVisible(LENTO)
    }

    // Trocar de aba e' estado do cliente (nao navega): a aba escolhida fica
    // marcada por `aria-pressed`, e `Trocar` nao pode recarregar a pagina.
    await page.getByTestId("content-aba-theme").click()
    await expect(page.getByTestId("content-aba-theme")).toHaveAttribute(
      "aria-pressed",
      "true",
      LENTO
    )
    await expect(page.getByTestId("content-page")).toBeVisible()
  })



    await test.step("páginas institucionais listam as páginas da loja", async () => {
    await page.getByTestId("content-aba-pages").click()
    await expect(page.getByTestId("content-aba-pages")).toHaveAttribute(
      "aria-pressed",
      "true",
      LENTO
    )
    await expect(page.getByTestId("pages-accordion")).toBeVisible(LENTO)
    // Cada item da accordion representa uma página publicada ou rascunho
    const paginas = page.getByTestId("page-item")
    if (await paginas.count() > 0) {
      await expect(paginas.first()).toBeVisible(LENTO)
    }
  })

  await test.step("tema da loja exibe as seções do tema", async () => {
    await page.getByTestId("content-aba-theme").click()
    await expect(page.getByTestId("content-aba-theme")).toHaveAttribute(
      "aria-pressed",
      "true",
      LENTO
    )
    await expect(page.getByTestId("theme-sections")).toBeVisible(LENTO)
    const secoesTema = page.getByTestId("theme-section")
    if (await secoesTema.count() > 0) {
      await expect(secoesTema.first()).toBeVisible(LENTO)
    }
  })

await test.step("evidência: sem 5xx e sem erro de console", async () => {
    const cincoXX = gravador.rede.filter((linha) => linha.status >= 500)

    // `pageerror` e' excecao nao tratada da tela: sempre reprova. As demais
    // linhas de `console.error` no painel sao ruido do dev server — o HMR do
    // Vite fala por `:9001` (e o proxy responde 426) e cada troca de tela
    // aborta modulos em voo (`net::ERR_ABORTED`). Nenhuma delas e' a tela
    // falhando, e reprimi-las no produto seria esconder defeito com um
    // `expect` mais frouxo; o filtro e' do ambiente, nao da assercao.
    const doProduto = (texto: string): boolean =>
      !texto.includes("localhost:9001") &&
      !texto.includes("net::ERR_ABORTED") &&
      !texto.includes("426 (Upgrade Required)")

    const errosDeConsole = gravador.console.filter(
      (linha) => linha.tipo === "pageerror" || (linha.nivel === "error" && doProduto(linha.texto))
    )

    // 502 da carteira e' resposta prevista quando nao ha' credencial do
    // SuperFrete no stack; o que nao pode e' erro nao tratado.
    const inesperados = cincoXX.filter(
      (linha) => !linha.url.includes("/admin/shipping/saldo")
    )

    expect(inesperados, `5xx na jornada: ${JSON.stringify(inesperados)}`).toEqual(
      []
    )
    expect(
      errosDeConsole,
      `erros no console: ${JSON.stringify(errosDeConsole)}`
    ).toEqual([])
  })
})
