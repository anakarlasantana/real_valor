import { expect, test } from "../fixtures/gravador"
import { esperarHidratacao } from "../fixtures/hidratacao"
import { irPara } from "../fixtures/navegacao"

/**
 * Jornada da vitrine — descobrir a peça (RV-071 CA-1 e CA-2).
 *
 * O que se prova aqui é o que a cliente usa para **achar** a peça: o recorte dos
 * filtros aparecendo na contagem, e a busca respondendo quando o termo nao
 * existe. Os dois ja' tinham `data-testid` no componente e nenhum teste de
 * navegador os exercitava.
 *
 * A faceta nao e' inventada: o painel le' o que o catalogo devolve, e o catalogo
 * da stack de teste tem `Tamanho`, `Faixa de preco` e `Disponibilidade`.
 */
test("vitrine: home → catálogo → filtro → busca", async ({ page, gravador }) => {
  await test.step("a vitrine abre com a contagem de peças", async () => {
    await irPara(page, "/br/store")
    await expect(page.getByTestId("category-container")).toBeVisible()

    const contagem = page.getByTestId("catalog-count")
    await expect(contagem).toBeVisible()
    await expect(contagem).toHaveText(/\d+\s+pe[çc]as?/)
  })

  await test.step("o filtro muda a contagem e sobrevive ao fechar a gaveta", async () => {
    const contagem = page.getByTestId("catalog-count")
    const antes = await contagem.innerText()

    // A gaveta (`filter-drawer-button`) e' `small:hidden` no desktop
    // (`catalog-toolbar:53`): clicar nela em 1280px espera um elemento que nunca
    // fica visivel e o teste morre nos 120s sem dizer por que. Aqui o alvo e' o
    // painel lateral, que e' o mesmo componente (`filter-panel`).
    const painel = page.getByTestId("filter-panel")
    await expect(painel).toBeVisible()

    // A opcao sem resultado nasce `disabled` (filter-panel:125): a primeira
    // habilitada e' a escolha que existe de fato. O `name` e' a chave da URL
    // (`size`), e nao o titulo da faceta ("Tamanho") — medido: `size=M` filtra,
    // `Tamanho=M` nao.
    const opcao = painel.locator('input[type="checkbox"]:not([disabled])').first()

    await expect(opcao).toBeEnabled()
    await esperarHidratacao(opcao, {
      descricao: "o filtro nao hidratou: marcar a caixa nao escreveria na URL",
    })
    const chave = await opcao.getAttribute("name")
    const valor = await opcao.getAttribute("value")

    // O `label` e' o alvo do toque (§5.1.4), e e' o gesto da cliente.
    await opcao.locator("xpath=..").click()

    // A marcação escreve na URL na hora (`filter-panel:75`): a contagem nova e'
    // a consequencia, e e' ela que a cliente le como resposta ao filtro.
    await expect(page).toHaveURL(new RegExp(`${chave}=[^&]*${valor}`))
    await expect(contagem).not.toHaveText(antes)

    // O recorte sobrevive a recarregar: a URL e' o estado, nao um rascunho.
    const filtrada = await contagem.innerText()
    await irPara(page, `/br/store?${chave}=${valor}`)
    await expect(page.getByTestId("catalog-count")).toHaveText(filtrada)
  })

  await test.step("busca sem resultado mostra o estado vazio", async () => {
    await irPara(page, "/br/search?q=zzzzinexistente")
    await expect(page.getByTestId("search-page")).toBeVisible()
    await expect(page.getByTestId("search-empty-state")).toBeVisible()
    await expect(page.getByTestId("products-list")).toHaveCount(0)
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
