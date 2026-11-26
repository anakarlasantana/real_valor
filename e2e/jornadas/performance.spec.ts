import fs from "node:fs"
import path from "node:path"

import { expect, test } from "../fixtures/gravador"

/**
 * Jornada de latência (RV-075).
 *
 * **Roda só contra produção.** O `make e2e` sobe `target: dev` + `yarn dev`, e
 * ali cada rota é compilada sob demanda: o número mediria o compilador, não a
 * loja. O stack de medição é o `scripts/perf-stack.sh` (projeto `rv_perf`,
 * estágio `runner`, portas 8200/9200).
 *
 * O orçamento mora em `e2e/perf-budget.json` — versionado, e não literal no
 * teste — e a folga de 20% fica aqui, para variação de máquina não virar falha.
 */
const ORCAMENTO = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "perf-budget.json"), "utf8")
) as {
  folga: number
  vitals: { lcp_ms: number; inp_ms: number; cls: number }
  js_inicial_kb: number
  api_p95_ms: Record<string, number>
  amostras_api: number
}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8100"
const API = process.env.E2E_API_URL ?? "http://localhost:9100"

/** O teto real: o orçamento com a folga aplicada. */
const teto = (valor: number) => Math.round(valor * (1 + ORCAMENTO.folga))

/** Mede os Web Vitals na página já carregada. */
async function vitals(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0
        let cls = 0

        new PerformanceObserver((lista) => {
          const entradas = lista.getEntries()
          const ultima = entradas[entradas.length - 1] as PerformanceEntry & {
            startTime: number
          }
          if (ultima) lcp = Math.round(ultima.startTime)
        }).observe({ type: "largest-contentful-paint", buffered: true })

        new PerformanceObserver((lista) => {
          for (const e of lista.getEntries() as (PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          })[]) {
            if (!e.hadRecentInput) cls += e.value
          }
        }).observe({ type: "layout-shift", buffered: true })

        // Uma volta no event loop deixa os observers entregarem o que ja'
        // aconteceu; o `buffered: true` garante o que passou antes disto.
        setTimeout(() => resolve({ lcp, cls: Number(cls.toFixed(4)) }), 800)
      })
  )
}

/** p95 de uma rota, em ms, com `amostras` requisicoes. */
async function p95(page: import("@playwright/test").Page, url: string, base: string) {
  const tempos: number[] = []
  for (let i = 0; i < ORCAMENTO.amostras_api; i++) {
    const t0 = Date.now()
    await page.request.get(base + url)
    tempos.push(Date.now() - t0)
  }
  tempos.sort((a, b) => a - b)
  return tempos[Math.floor(tempos.length * 0.95) - 1] ?? tempos[tempos.length - 1]
}

test("performance: vitals, JS e p95 da API", async ({ page, gravador }) => {
  await test.step("a jornada recusa medir fora de produção", async () => {
    // O marcador confiável é o **bundle**: `next dev` (com turbopack) deixa
    // `turbopack` no HTML servido, e produção não. O `Cache-Control` NÃO serve
    // — medido: a home é dinâmica (lê o cookie do carrinho) e responde
    // `no-store` também em produção.
    const resposta = await page.request.get(BASE + "/br")
    const corpo = await resposta.text()

    const ehDev = corpo.includes("turbopack")

    if (ehDev) {
      test.skip(
        true,
        `a medição exige produção: suba com 'make perf-up' (rv_perf, :8200) e rode com E2E_BASE_URL=http://localhost:8200. Base atual: ${BASE}`
      )
    }
  })

  await test.step("home e PDP cabem no orçamento de vitals", async () => {
    for (const rota of ["/br", "/br/products/e2e-vestido-de-teste"]) {
      await page.goto(BASE + rota, { waitUntil: "load" })
      const { lcp, cls } = await vitals(page)

      expect(lcp, `${rota}: LCP ${lcp}ms acima de ${teto(ORCAMENTO.vitals.lcp_ms)}ms`).toBeLessThanOrEqual(
        teto(ORCAMENTO.vitals.lcp_ms)
      )
      expect(cls, `${rota}: CLS ${cls} acima de ${teto(ORCAMENTO.vitals.cls)}`).toBeLessThanOrEqual(
        teto(ORCAMENTO.vitals.cls)
      )
    }
  })

  await test.step("o JavaScript inicial cabe no orçamento", async () => {
    await page.goto(BASE + "/br", { waitUntil: "load" })

    // `transferSize` e' o que trafega (comprimido): e' o numero que pesa na
    // conexao da cliente, e o que o doc 05 §5.3.1 chama de "JS inicial (gz)".
    const bytes = await page.evaluate(() => {
      const scripts = performance
        .getEntriesByType("resource")
        .filter((r) => (r as PerformanceResourceTiming).initiatorType === "script") as PerformanceResourceTiming[]

      // `transferSize` vem 0 quando a resposta saiu do cache do navegador ou
      // quando o recurso foi servido por HTTP/2 sem tamanho exposto: nesse caso
      // o tamanho real e' `decodedBodySize`. Somar so' `transferSize` dava 0kB.
      return scripts.reduce(
        (soma, r) => soma + (r.transferSize || r.encodedBodySize || r.decodedBodySize || 0),
        0
      )
    })

    const kb = Math.round(bytes / 1024)
    expect(
      kb,
      `home envia ${kb}kB de JS acima de ${teto(ORCAMENTO.js_inicial_kb)}kB`
    ).toBeLessThanOrEqual(teto(ORCAMENTO.js_inicial_kb))
  })

  await test.step("o p95 das rotas de API cabe no orçamento", async () => {
    for (const [rota, orcado] of Object.entries(ORCAMENTO.api_p95_ms)) {
      const medido = await p95(page, rota, API)
      expect(
        medido,
        `${rota}: p95 ${medido}ms acima de ${teto(orcado)}ms`
      ).toBeLessThanOrEqual(teto(orcado))
    }
  })

  await test.step("evidência: sem 5xx na medição", async () => {
    const cincoXX = gravador.rede.filter((linha) => linha.status >= 500)
    expect(cincoXX, `5xx na medição: ${JSON.stringify(cincoXX)}`).toEqual([])
  })
})
