import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

/**
 * Configuracao do teste ponta-a-ponta (fase 3 do doc 20).
 *
 * Roda contra a stack `rv_e2e` (`scripts/e2e-stack.sh up`), nunca a de dev.
 *
 * Evidencia: tudo o que o diagnostico precisa vai para `E2E_EVIDENCE_DIR`
 * (padrao `evidence/<timestamp>/`), que e' gitignored:
 *   - `resultado.json`  — saida do runner (passo, erro, duracao)
 *   - `captura/…`       — rede e console, escritos pela fixture `gravador`
 *   - `playwright/…`    — trace e video (retain-on-failure)
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8100"

// Resolvido contra o CWD (a raiz do repo), nao contra a pasta do config: o
// `outputFile` do reporter e os `outputDir` são relativos ao config por padrao,
// e a primeira execucao escreveu a evidencia em `e2e/evidence/`.
const EVIDENCIA = path.resolve(
  process.cwd(),
  process.env.E2E_EVIDENCE_DIR ??
    path.join("evidence", new Date().toISOString().replace(/[:.]/g, "-"))
)

export default defineConfig({
  testDir: "./jornadas",
  outputDir: path.join(EVIDENCIA, "playwright"),
  // Curto de proposito: jornada que trava vira evidencia em < 1 min.
  timeout: 120_000,
  expect: { timeout: 8_000 },
  // Uma jornada por vez: a stack e' unica e o estado (carrinho, pedido) e' dela.
  fullyParallel: false,
  workers: 1,
  // Um retry local esconde flake; o produto precisa falhar. Ver doc 20 §20.4.
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(EVIDENCIA, "resultado.json") }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    trace: "retain-on-failure",
    // `video` desligado: a conversao do ffmpeg travava o runner depois da falha.
    // O `trace` ja carga DOM, rede e console, que e o que o diagnostico le.
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // `chromium` fica PRIMEIRO de proposito: os alvos `make e2e`/`e2e-cliente`
      // filtram por `--grep` e nao por projeto, e o primeiro projeto e' quem
      // executa o spec da cliente.
      name: "chromium",
      testMatch: /cliente\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // A jornada do lojista fala com o painel, servido pelo backend (`:9100`).
      name: "lojista",
      testMatch: /lojista\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_ADMIN_URL ?? "http://localhost:9100/painel",
      },
    },
    {
      name: "vitrine",
      testMatch: /vitrine\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "produto",
      testMatch: /produto\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "sacola",
      testMatch: /sacola\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "conta",
      testMatch: /conta\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "checkout",
      testMatch: /checkout\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "pos-venda",
      testMatch: /pos-venda\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // O celular e' o aparelho da maioria do trafego (doc 05 §5.6) e o divisor
      // mobile/desktop e' `small: 1024px`. Pixel 7 = 412x915, abaixo dele.
      name: "mobile-chrome",
      testMatch: /responsividade\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
})
