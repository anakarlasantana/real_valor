/**
 * O endereço da API do painel — e o que a tela lê de volta.
 * -------------------------------------------------------------------------
 * `apiUrl` é a única peça do CRM que decide **onde** uma chamada bate, e a
 * diferença entre os dois endereços do painel é a diferença entre 200 e um 404
 * HTML. Medido com o painel publicado pelo storefront:
 *
 *     GET :8000/admin/content?surface=home      → 307 → /br/admin/content?surface=home
 *     GET :8000/br/admin/content?surface=home   → 404 (`Content-Type: text/html`)
 *     GET :8000/painel-api/admin/content        → 401 JSON
 *
 * É esse 404 que estourava o `res.json()` da tela (`SyntaxError` antes de o
 * `res.ok` ser lido): o defeito que o `apiUrl` fecha na saída e o `readJson`
 * fecha na volta. Os dois são testados como função pura, e não pela tela — o
 * painel não tem jsdom (`admin/jest.config.js`).
 *
 * O `__BACKEND_URL__` do teste é um global: no bundle ele é uma constante
 * trocada em tempo de build pelo Vite (`define.__BACKEND_URL__`, em
 * `@medusajs/admin-bundler`), e em `node` — o `testEnvironment` do runner do CRM
 * — o identificador não existe. Escrevê-lo no `globalThis` exercita o mesmo
 * caminho de leitura que a função faz no navegador (identificador livre → objeto
 * global), e é o que permite medir o ramo **com** base; o ramo sem base é o
 * estado natural do arquivo aqui, e é o caso do painel servido pelo próprio
 * backend.
 */
import { apiUrl, readJson } from "../api-url"

/** O identificador livre do bundle, como este spec o define. */
const globals = globalThis as { __BACKEND_URL__?: string }

afterEach(() => {
  delete globals.__BACKEND_URL__
})

describe("apiUrl", () => {
  it("sem `__BACKEND_URL__`, o caminho sai como entrou", () => {
    // O caso do runner do CRM (node) e o de um bundle sem `MEDUSA_BACKEND_URL`:
    // relativo à origem da página, que é o que o dashboard faz com `?? "/"`.
    expect(apiUrl("/admin/content?surface=home")).toBe(
      "/admin/content?surface=home"
    )
  })

  it("base vazia — ou só espaço — é o mesmo que base nenhuma", () => {
    // `MEDUSA_BACKEND_URL` em branco: o bundler grava `""` e o painel fica
    // relativo à página. Uma base com espaço não é endereço de ninguém.
    globals.__BACKEND_URL__ = ""
    expect(apiUrl("/admin/content")).toBe("/admin/content")

    globals.__BACKEND_URL__ = "   "
    expect(apiUrl("/admin/content")).toBe("/admin/content")
  })

  it("com a base local, o caminho vira o endereço absoluto da API", () => {
    globals.__BACKEND_URL__ = "http://localhost:9000"

    expect(apiUrl("/admin/content?surface=home")).toBe(
      "http://localhost:9000/admin/content?surface=home"
    )
  })

  it("com a base do túnel, o prefixo `/painel-api` entra no caminho", () => {
    // É o valor que o `make tunnel` grava em `MEDUSA_BACKEND_URL`: de fora, a
    // API responde no MESMO endereço da página, sob o prefixo (§11.6.2).
    globals.__BACKEND_URL__ = "https://exemplo.ngrok-free.dev/painel-api"

    expect(apiUrl("/admin/shipping")).toBe(
      "https://exemplo.ngrok-free.dev/painel-api/admin/shipping"
    )
  })

  it("a barra final da base não vira barra dupla no caminho", () => {
    // `MEDUSA_BACKEND_URL` com e sem `/` descrevem o mesmo endereço; `//admin/…`
    // não é rota de ninguém.
    globals.__BACKEND_URL__ = "https://exemplo.ngrok-free.dev/painel-api///"

    expect(apiUrl("/admin/content/pages")).toBe(
      "https://exemplo.ngrok-free.dev/painel-api/admin/content/pages"
    )
  })

  it("um caminho sem barra inicial ganha uma", () => {
    // O contrato é `/admin/...`; a normalização existe para que um esquecimento
    // não vire `…/painel-apiadmin/content`.
    globals.__BACKEND_URL__ = "http://localhost:9000"

    expect(apiUrl("admin/content")).toBe("http://localhost:9000/admin/content")
  })
})

describe("readJson", () => {
  /** O mínimo de `Response` que `readJson` usa: o `json()` que responde ou lança. */
  function respostaCom(json: () => Promise<unknown>): Response {
    return { json } as unknown as Response
  }

  it("devolve o corpo quando há JSON", async () => {
    const res = respostaCom(async () => ({ schema: { version: 15 } }))

    await expect(readJson(res)).resolves.toEqual({ schema: { version: 15 } })
  })

  it("devolve `{}` quando o corpo não é JSON (o 404 HTML)", async () => {
    // O `<` de `<!DOCTYPE html>` é o primeiro caractere que o `JSON.parse` do
    // `res.json()` recusa — o `SyntaxError` medido no painel publicado. Com
    // `{}`, quem decide a mensagem volta a ser o `res.ok`.
    const res = respostaCom(async () => {
      throw new SyntaxError(
        "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"
      )
    })

    await expect(readJson(res)).resolves.toEqual({})
  })
})
