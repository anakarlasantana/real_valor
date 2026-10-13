/**
 * Onde o painel do CRM fala com a API — e como ele lê o que volta.
 * -------------------------------------------------------------------------
 * Toda chamada que o CRM faz à API (`/admin/...`) sai por `apiUrl`. Não é
 * cerimônia: um `fetch` com o caminho relativo à raiz — `"/admin/content"` — é
 * resolvido contra o endereço que **serve a página**, e isso só dá certo
 * enquanto a página vem do próprio backend.
 *
 * O painel também é publicado pelo endereço do storefront (`/painel`, pelas
 * reescritas do `frontend/next.config.js`; ver
 * `docs/real-valor/11-ambiente-local.md` §11.6.2), e ali a mesma linha não chega
 * à API: o middleware da loja (`frontend/src/middleware.ts`) prefixa o país em
 * toda rota que não conhece e responde **307**. Medido, com o painel publicado:
 *
 *     GET :8000/admin/content?surface=home     → 307 → /br/admin/content?surface=home
 *     GET :8000/br/admin/content?surface=home  → 404 (HTML da vitrine)
 *     GET :8000/painel-api/admin/content       → 401 JSON  ← o caminho certo
 *     GET :9000/admin/content?surface=home     → 401 JSON  (o local nunca quebrou)
 *
 * O corpo do 404 chega com `Content-Type: text/html`, então o `res.json()` da
 * tela estoura um `SyntaxError` **antes** de o `res.ok` ser lido: o lojista vê
 * "Não foi possível carregar o schema." e o status HTTP — a única pista que
 * explica a falha — morre dentro de um erro de parse (é o outro lado do mesmo
 * defeito, tratado por `readJson`, abaixo).
 *
 * A base é o `__BACKEND_URL__` do bundle: o mesmo valor que o dashboard
 * instalado usa como `baseUrl` do SDK (`backendUrl = __BACKEND_URL__ ?? "/"`, em
 * `@medusajs/dashboard`), injetado pelo Vite a partir do `admin.backendUrl` do
 * `backend/medusa-config.ts`. Com ele, o painel fala com a API pela **mesma
 * origem** da página — inclusive de fora, onde o valor é
 * `https://<endereço>/painel-api` —, e o caminho deixa de depender de quem serve
 * a tela.
 */

/**
 * O caminho do painel (`/admin/...`) no endereço da API.
 *
 * Recebe sempre um caminho do painel, com a query inteira e já codificada
 * (`/admin/content?surface=…`): não é um resolvedor de URL e não completa
 * segmento nenhum. A barra final da base é normalizada porque ela é
 * configuração: `MEDUSA_BACKEND_URL` com e sem `/` descrevem o mesmo endereço, e
 * `//admin/...` não é rota de ninguém.
 */
export function apiUrl(path: string): string {
  // `typeof` e não `??`: o valor chega por três caminhos e a leitura tem de valer
  // nos três. No bundle, o Vite troca a constante por um literal (o `define` do
  // `@medusajs/admin-bundler`); no dev server, o `env.mjs` do próprio Vite
  // materializa o mesmo `define` no objeto global (medido no navegador:
  // `window.__BACKEND_URL__` = o valor do `.env`); e no jest do CRM, que roda em
  // `node`, o identificador não existe — é aqui que o `typeof` é obrigatório,
  // porque a leitura direta seria `ReferenceError`.
  const base = typeof __BACKEND_URL__ === "string" ? __BACKEND_URL__ : ""
  const caminho = path.startsWith("/") ? path : `/${path}`

  // Sem base, o caminho sai como entrou: relativo à origem da página, que é o
  // que o dashboard faz com `?? "/"` — e é o certo quando a API responde no
  // mesmo endereço da tela.
  if (base.trim() === "") {
    return caminho
  }

  return `${base.trim().replace(/\/+$/, "")}${caminho}`
}

/**
 * O corpo da resposta como JSON — ou `{}` quando não há JSON nenhum.
 *
 * Existe pelo outro lado do defeito do `apiUrl`: uma resposta que **não** veio
 * da API (o 404 HTML de quem serve a página por outro endereço, um interstitial
 * de túnel, um proxy no caminho) não é um erro da API, e `res.json()` nela lança
 * `SyntaxError`. Com ele no `catch` da tela, um corpo que não é JSON passa a ser
 * lido como falha de rede: a mensagem que o lojista vê é a genérica, e o status
 * HTTP — que é quem de fato sabe o que aconteceu — desaparece. Com `{}`, quem
 * decide a mensagem continua sendo o `res.ok`.
 *
 * O payload não é tipado aqui de propósito: o tipo de cada resposta é o do
 * caminho que a leu (`Section[]`, `PageRow[]`, `PedidoEnvio[]`), e o painel não
 * declara a forma do contrato (ver `panel-wiring.unit.spec.ts`).
 */
export async function readJson(res: Response): Promise<Record<string, any>> {
  try {
    return (await res.json()) as Record<string, any>
  } catch {
    return {}
  }
}
