// Guarda do testid: seletor de spec tem de existir no produto. Quatro vezes o
// "defeito de teste" foi seletor inexistente, cada um custando 120s de timeout.
//   node scripts/check-testids.mjs

import { readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { walk } from "./lib/imports.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const SPECS = join(root, "e2e", "jornadas")
const COMPONENTES = [join(root, "frontend", "src"), join(root, "admin", "src")]
const EXT = [".ts", ".tsx"]

const rel = (p) => relative(root, p).split("\\").join("/")
const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/** Os testids que o spec procura, com arquivo e linha. */
function seletoresDosSpecs() {
  const achados = []

  for (const arquivo of walk(SPECS, EXT)) {
    const linhas = readFileSync(arquivo, "utf8").split("\n")

    linhas.forEach((linha, i) => {
      const re = /getByTestId\(\s*(["'`])([^"'`]+)\1/g
      let m

      while ((m = re.exec(linha)) !== null) {
        const [original, , valor] = m

        // Montado em runtime: nao ha' o que conferir estaticamente.
        if (original.includes("${")) continue

        achados.push({ testid: valor, arquivo: rel(arquivo), linha: i + 1 })
      }
    })
  }

  return achados
}

/** Todo testid que o produto declara — literal ou por template. */
function testidsDoProduto() {
  const declarados = new Set()
  const prefixos = []
  const dinamicos = new Set()

  for (const raiz of COMPONENTES) {
    for (const arquivo of walk(raiz, EXT)) {
      const texto = readFileSync(arquivo, "utf8")

      for (const m of texto.matchAll(/data-testid=["']([^"']+)["']/g)) {
        declarados.add(m[1])
      }

      // `data-testid={`theme-${x}`}`: guarda o prefixo para casar por familia.
      for (const m of texto.matchAll(/data-testid=\{`([^`$]*)\$\{/g)) {
        prefixos.push(m[1])
      }

      // `{dataTestId ?? "empty-state"}`: o fallback e' literal.
      for (const m of texto.matchAll(/data-testid=\{[^}]*\?\?\s*["']([^"']+)["'][^}]*\}/g)) {
        declarados.add(m[1])
      }

      // Literal dentro de expressao (`cond ? "theme-sections" : undefined`).
      for (const m of texto.matchAll(/data-testid=\{([^}]*)\}/g)) {
        for (const lit of m[1].matchAll(/["']([a-z0-9][a-z0-9-]*)["']/gi)) {
          declarados.add(lit[1])
        }
      }

      // `testId: "orders-link"`: literal num objeto, aplicado por prop.
      for (const m of texto.matchAll(/\btestId:\s*["']([^"']+)["']/g)) {
        declarados.add(m[1])
      }

      // Valor por prop/dado (`data-testid={x.testId}`): idem.
      for (const m of texto.matchAll(/data-testid=\{([^`][^}]*)\}/g)) {
        const expr = m[1].trim()
        if (!expr) continue
        // `data-testid={`x-${y}`}` ja' foi tratado acima (template).
        if (expr.includes("`")) continue
        dinamicos.add(expr)
      }
    }
  }

  return { declarados, prefixos, dinamicos }
}

const seletores = seletoresDosSpecs()
const { declarados, prefixos, dinamicos } = testidsDoProduto()

// Ha' componente montando testid em runtime: a mensagem de falha avisa, em vez
// de inventar exigencia sobre o que so' existe em execucao.
const temDinamico = dinamicos.size > 0

const ausentes = seletores.filter(({ testid }) => {
  if (declarados.has(testid)) return false
  if (prefixos.some((prefixo) => prefixo && testid.startsWith(prefixo))) return false
  return true
})

if (ausentes.length > 0) {
  for (const { testid, arquivo, linha } of ausentes) {
    console.error(`FAIL ${arquivo}:${linha} — getByTestId("${testid}") nao existe no produto`)
  }
  console.error(
    `\n${ausentes.length} seletor(es) orfao(s). O spec espera um elemento que o componente nao` +
      ` declara — o teste morre em timeout em vez de falhar com nome.` +
      (temDinamico
        ? `\n(ha' componente montando o testid em runtime; se o valor vier de la', declare-o literal)`
        : "")
  )
  process.exit(1)
}

console.log(
  `  ok   ${seletores.length} seletor(es) de ${semAcento("jornada")} com testid no produto`
)
