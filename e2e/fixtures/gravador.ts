import fs from "node:fs"
import path from "node:path"

import { test as base, expect } from "@playwright/test"

/**
 * O gravador — a evidencia que o diagnóstico consome.
 *
 * Escuta a pagina e escreve dois NDJSON por jornada em
 * `E2E_EVIDENCE_DIR/captura/`:
 *
 *   <jornada>.network.ndjson   uma linha por resposta: metodo, url, status, ms
 *   <jornada>.console.ndjson   console.* e pageerror, com o texto
 *
 * Por que NDJSON e nao um JSON gigante: a linha e' auto-contida (da' para
 * `grep 5xx` e para ler no editor sem carregar o arquivo inteiro), e o
 * `EvidenceDigest` do harness le exatamente esse formato.
 *
 * Por que fixture e nao `page.on(...)` em cada spec: esquecer o listener e'
 * silencioso — o teste passa e nao ha' evidencia nenhuma.
 */

export type RespostaRede = {
  em: string
  metodo: string
  url: string
  status: number
  ms: number
}

export type LinhaConsole = {
  em: string
  tipo: "console" | "pageerror" | "requestfailed"
  nivel: string
  texto: string
}

export type Gravador = {
  dir: string
  rede: RespostaRede[]
  console: LinhaConsole[]
}

const EVIDENCIA = process.env.E2E_EVIDENCE_DIR ?? path.join("evidence", "manual")

export const test = base.extend<{ gravador: Gravador }>({
  gravador: async ({ page }, use, testInfo) => {
    const dir = path.join(EVIDENCIA, "captura")
    fs.mkdirSync(dir, { recursive: true })

    const rede: RespostaRede[] = []
    const console: LinhaConsole[] = []
    const em = () => new Date().toISOString()
    const inicio = new Map<string, number>()

    page.on("request", (req) => inicio.set(req.url() + req.method(), Date.now()))

    page.on("response", (res) => {
      const chave = res.url() + res.request().method()
      const t0 = inicio.get(chave) ?? Date.now()

      rede.push({
        em: em(),
        metodo: res.request().method(),
        url: res.url(),
        status: res.status(),
        ms: Date.now() - t0,
      })
    })

    page.on("console", (msg) => {
      console.push({
        em: em(),
        tipo: "console",
        nivel: msg.type(),
        texto: msg.text().slice(0, 500),
      })
    })

    page.on("pageerror", (erro) => {
      console.push({
        em: em(),
        tipo: "pageerror",
        nivel: "error",
        texto: String(erro.message ?? erro).slice(0, 500),
      })
    })

    page.on("requestfailed", (req) => {
      console.push({
        em: em(),
        tipo: "requestfailed",
        nivel: "error",
        texto: `${req.method()} ${req.url()} — ${req.failure()?.errorText ?? "?"}`,
      })
    })

    await use({ dir, rede, console })

    // Roda tambem quando o teste falha: e' exatamente quando a evidencia importa.
    const base = testInfo.titlePath.join("-").replace(/[^\w.-]+/g, "_").slice(0, 80)

    fs.writeFileSync(
      path.join(dir, `${base}.network.ndjson`),
      rede.map((linha) => JSON.stringify(linha)).join("\n") + "\n"
    )
    fs.writeFileSync(
      path.join(dir, `${base}.console.ndjson`),
      console.map((linha) => JSON.stringify(linha)).join("\n") + "\n"
    )
  },
})

export { expect }
