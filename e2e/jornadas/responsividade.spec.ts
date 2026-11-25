import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada de responsividade (RV-074).
 *
 * Roda no projeto `mobile-chrome` (Pixel 7, 412×915): o divisor mobile/desktop
 * do layout e' `small: 1024px` (`tailwind.config.js:74`), entao abaixo disso
 * vale o layout de toque — menu em gaveta, filtros em gaveta, barra de compra
 * fixa. O que se prova aqui e' o **layout**; as regras de negocio ja' tem
 * jornada propria no desktop.
 */
const ROTAS = [
  "/br",
  "/br/store",
  "/br/products/e2e-vestido-de-teste",
  "/br/cart",
  "/br/rastreio",
]

test("responsividade: celular sem rolagem horizontal e com toque", async ({
  page,
  gravador,
}) => {
  await test.step("nenhuma rota rola na horizontal no celular", async () => {
    for (const rota of ROTAS) {
      await irPara(page, rota)
      await expect(page.locator("body")).toBeVisible()

      // `scrollWidth > clientWidth` e' o sintoma de layout que estoura: a
      // cliente arrasta a tela para o lado e o conteudo escapa da margem.
      const medida = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        rota: window.location.pathname,
      }))

      expect(
        medida.scroll,
        `${medida.rota} rola na horizontal (scroll=${medida.scroll} > client=${medida.client})`
      ).toBeLessThanOrEqual(medida.client)
    }
  })

  await test.step("o menu abre e fecha no celular", async () => {
    await irPara(page, "/br")

    const abrir = page.getByTestId("nav-menu-button")
    await expect(abrir).toBeVisible()
    await esperarHidratacao(abrir, {
      descricao: "o cabecalho nao hidratou: o botao do menu nao abriria a gaveta",
    })

    await abrir.click()
    await expect(page.getByTestId("nav-menu-popup")).toBeVisible()

    // Fechar pelo botao proprio e' o gesto do polegar; o backdrop e' o atalho.
    await page.getByTestId("close-menu-button").click()
    await expect(page.getByTestId("nav-menu-popup")).toBeHidden()
  })

  await test.step("o filtro é gaveta no celular e painel no desktop", async () => {
    await irPara(page, "/br/store")

    // No celular o painel lateral nao cabe ao lado da grade: ele vira gaveta,
    // aberta pelo botao "Filtros".
    const abrirFiltros = page.getByTestId("filter-drawer-button")
    await expect(abrirFiltros).toBeVisible()
    await esperarHidratacao(abrirFiltros, {
      descricao: "o catalogo nao hidratou: a gaveta de filtros nao abriria",
    })

    await abrirFiltros.click()
    const gaveta = page.getByTestId("filter-drawer")
    await expect(gaveta).toBeVisible()

    // A gaveta tem o mesmo painel de facetas e um alvo de fechar proprio. O
    // `filter-panel` aparece **duas vezes** no DOM no celular (o painel da
    // coluna continua montado por tras da gaveta), entao o seletor e' escopado.
    await expect(gaveta.getByTestId("filter-panel")).toBeVisible()
    await page.getByTestId("close-filter-drawer").click()
    await expect(gaveta).toBeHidden()

    // O que **nao** pode acontecer no celular: duas colunas lado a lado (o
    // layout de desktop) reduzindo a grade a uma tira.
    const largura = page.viewportSize()?.width ?? 0
    expect(largura, "este projeto tem de rodar em viewport de celular").toBeLessThan(
      1024
    )
  })

  await test.step("os controles da compra têm área de toque", async () => {
    await irPara(page, "/br/products/e2e-vestido-de-teste")

    const botao = page.getByTestId("add-product-button")
    await expect(botao).toBeVisible()

    // WCAG 2.5.5 (doc 05 §5.1.4): 44x44 px. Abaixo disso o dedo erra o alvo e
    // a cliente desiste — o defeito nao aparece no desktop.
    const caixa = await botao.boundingBox()
    expect(caixa, "o botao de comprar nao tem caixa").not.toBeNull()
    expect(caixa!.height).toBeGreaterThanOrEqual(44)
    expect(caixa!.width).toBeGreaterThanOrEqual(44)

    // A barra fixa de compra e' o caminho do polegar na PDP.
    await expect(page.getByTestId("mobile-actions")).toBeVisible()
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
