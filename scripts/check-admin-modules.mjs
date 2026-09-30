/**
 * Guarda do grafo de módulos do painel (dev server do Vite).
 * -----------------------------------------------------------------
 * `make health` responde 200 para /painel mesmo com o painel QUEBRADO: quem
 * responde é o shell HTML, não o bundle. E `make logs-admin` também não basta —
 * o `@medusajs/framework` silencia no log toda requisição que contenha `@fs`,
 * `@id`, `@vite`, `@react` ou `node_modules` (`NOISY_ENDPOINTS_CHUNKS`), e são
 * justamente essas as que carregam os módulos: a falha acontece com o log
 * limpo e o alvo dizendo "OK".
 *
 * Por isso este script não lê log: ele PERCORRE o grafo de módulos, a partir do
 * `entry.jsx`, e falha quando um módulo responde
 *
 *   (a) 404 — o arquivo não existe mais. Foi assim que o /painel morreu em
 *       2026-09-30: o browser pedia `deps/login-REAKYYFI-OQZ7MJXX.js` (404)
 *       enquanto em disco só havia `deps/login-REAKYYFI-NUES2SED.js` (200). O
 *       nome do chunk do otimizador carrega o hash da EXECUÇÃO dele, e a aba
 *       estava presa na execução anterior — o arquivo dela havia sido apagado.
 *       Quem trocava essa execução com o dev server no ar era o
 *       `make build-admin`: o `cacheDir` do Vite do admin é
 *       `/app/backend/node_modules/.vite`, o MESMO diretório do dev server, que
 *       roda noutro container (medido: `deps/` com 0 arquivos 20 s dentro do
 *       build). O alvo agora monta um volume anônimo sobre
 *       `/app/backend/node_modules` — o cache do build nasce e morre descartável
 *       — então ele não troca mais a execução do servidor.
 *   (b) HTML (200 `text/html`) — o fallback da SPA respondeu o `index.html` no
 *       lugar do módulo: o outro jeito de "Error loading dynamically imported
 *       module" (URL de módulo inexistente caindo no fallback).
 *
 * Rode com (o dev server tem de estar no ar; não precisa de banco):
 *   node scripts/check-admin-modules.mjs
 *   ADMIN_URL=http://localhost:9000 ADMIN_PATH=/painel node scripts/check-admin-modules.mjs
 *
 * Sem framework de propósito, como o `check-boundaries.mjs`: é HTTP e regex, e
 * a saída tem de caber no `make logs-admin` (segundos).
 */

const BASE = (process.env.ADMIN_URL ?? "http://localhost:9000").replace(/\/+$/, "")
const ADMIN_PATH = process.env.ADMIN_PATH ?? "/painel"
const ENTRY = `${BASE}${ADMIN_PATH}/entry.jsx`

// Limites de percurso: o grafo do painel é grande (centenas de módulos), e o que
// interessa é o começo dele — o entry e os primeiros saltos, que é onde ficam o
// roteador (com o glob de todas as rotas) e o cache do otimizador de deps.
const MAX_FETCHES = Number(process.env.ADMIN_MAX ?? 300)
const MAX_DEPTH = Number(process.env.ADMIN_DEPTH ?? 6)

// Só URLs que são REQUISIÇÃO DE MÓDULO entram na fila: as que o Vite serve
// transformadas (`@fs`, `@id`, `@vite`, `@react`, `node_modules`, `deps`) e as
// dos fontes (`src/`) — mais qualquer coisa com extensão de módulo.
const MODULE_HINT = /(\/@fs\/|\/@id\/|\/@vite\/|\/@react|node_modules|deps\/|\/src\/)/
const MODULE_EXT = /\.(m?[jt]sx?|css)(\?|$)/

/** Todas as strings entre aspas que começam com o caminho do painel. */
function extractModuleUrls(body) {
  const urls = new Set()
  const re = /["'`](\/painel\/[^"'`\s)<>]+)["'`]/g
  let m
  while ((m = re.exec(body)) !== null) {
    const url = m[1]
    if (MODULE_HINT.test(url) || MODULE_EXT.test(url)) urls.add(url)
  }
  return urls
}

const isDep = (url) => url.includes("/deps/")

async function fetchModule(url) {
  const res = await fetch(`${BASE}${url}`, {
    cache: "no-store",
    headers: { "cache-control": "no-cache", accept: "*/*" },
  })
  const type = res.headers.get("content-type") ?? ""
  return { status: res.status, type, body: res.ok ? await res.text() : "" }
}

const queue = [{ url: `${ADMIN_PATH}/entry.jsx`, depth: 0 }]
const seen = new Set([`${ADMIN_PATH}/entry.jsx`])
const failures = []
let fetched = 0
let depsChecked = 0

while (queue.length > 0 && fetched < MAX_FETCHES) {
  const { url, depth } = queue.shift()
  fetched += 1

  let r
  try {
    r = await fetchModule(url)
  } catch (err) {
    failures.push({ url, why: `sem resposta (${err.message})` })
    continue
  }

  // O fallback da SPA responde 200 text/html para um módulo que não existe.
  if (r.status !== 200) failures.push({ url, why: `HTTP ${r.status}` })
  else if (r.type.includes("text/html"))
    failures.push({ url, why: `HTTP 200 text/html (fallback da SPA, não o módulo)` })

  if (isDep(url)) depsChecked += 1
  if (!r.body || depth >= MAX_DEPTH || url.endsWith(".css")) continue

  for (const next of extractModuleUrls(r.body)) {
    if (seen.has(next)) continue
    seen.add(next)
    queue.push({ url: next, depth: depth + 1 })
  }
}

console.log(
  `  ${fetched} modulo(s) do painel conferido(s) ` +
    `(${depsChecked} chunk(s) do otimizador de deps, ${seen.size} alcancado(s)).`
)

if (failures.length > 0) {
  console.error("")
  console.error(`FALHA: ${failures.length} modulo(s) do painel nao carregam (o /painel quebra no browser).`)
  for (const f of failures.slice(0, 10)) console.error(`  ${f.url} -> ${f.why}`)
  if (failures.length > 10) console.error(`  ... e mais ${failures.length - 10}.`)
  console.error("")
  console.error("Causa tipica: o otimizador de deps do Vite rodou de novo e a aba estava no grafo antigo")
  console.error("(ela pede o nome da execucao ANTERIOR, que foi apagado). Trocam a execucao:")
  console.error("`make restart`/recriacao do container, ou qualquer build que escreva no cacheDir do")
  console.error("dev server — o `make build-admin` NAO escreve mais (roda com volume isolado; ver o alvo).")
  console.error("Correcao: docker compose restart backend   (o Vite re-otimiza na subida)")
  console.error("          e recarregue a aba do painel (F5; Ctrl+Shift+R se ela insistir): a aba presa no")
  console.error("          grafo antigo continua pedindo o chunk velho por conta propria.")
  process.exit(1)
}

console.log("  OK: todos os modulos do painel responderam JS (nenhum 404, nenhum fallback).")
