/**
 * Onde o painel do CRM fala com a API — e como ele lê o que volta.
 *
 * Toda chamada `/admin/...` sai por `apiUrl`: um `fetch` com caminho relativo é
 * resolvido contra o endereço que **serve a página**, e isso só dá certo enquanto a
 * página vem do backend. O painel também é publicado pelo storefront (`/painel`,
 * reescritas do `frontend/next.config.js`; doc 11 §11.6.2), e ali o middleware da
 * loja prefixa o país e responde **307** — `GET :8000/admin/content` vira
 * `:8000/br/admin/content`, que devolve o **404 HTML** da vitrine; o `res.json()` da
 * tela estoura `SyntaxError` **antes** de o `res.ok` ser lido, e o status HTTP morre
 * dentro do erro de parse (o outro lado do mesmo defeito é o `readJson`, abaixo). A
 * base é o `__BACKEND_URL__` do bundle (o `baseUrl` do SDK do dashboard, injetado
 * pelo Vite de `admin.backendUrl`): o painel fala com a API pela **mesma origem** da
 * página, inclusive de fora (`https://<endereço>/painel-api`).
 */

/**
 * O caminho do painel (`/admin/...`, query inteira e já codificada) no endereço da
 * API: não é resolvedor de URL e não completa segmento. A barra final da base é
 * normalizada porque ela é configuração (`//admin/...` não é rota de ninguém).
 */
export function apiUrl(path: string): string {
  // `typeof` e não `??`: o valor chega por três caminhos — o `define` do Vite no
  // bundle, o `env.mjs` no dev server e o jest do CRM em `node`, onde o
  // identificador não existe e a leitura direta seria `ReferenceError`.
  const base = typeof __BACKEND_URL__ === "string" ? __BACKEND_URL__ : ""
  const caminho = path.startsWith("/") ? path : `/${path}`

  // Sem base, o caminho sai como entrou: relativo à origem da página.
  if (base.trim() === "") {
    return caminho
  }

  return `${base.trim().replace(/\/+$/, "")}${caminho}`
}

/**
 * O corpo da resposta como JSON — ou `{}` quando não há JSON nenhum.
 *
 * Uma resposta que **não** veio da API (o 404 HTML, um interstitial de túnel, um
 * proxy) faz `res.json()` lançar `SyntaxError`, e o `catch` da tela leria isso como
 * falha de rede: com `{}`, quem decide a mensagem continua sendo o `res.ok`. O
 * payload não é tipado aqui de propósito: o tipo de cada resposta é o do caminho que
 * a leu, e o painel não declara a forma do contrato.
 */
export async function readJson(res: Response): Promise<Record<string, any>> {
  try {
    return (await res.json()) as Record<string, any>
  } catch {
    return {}
  }
}
