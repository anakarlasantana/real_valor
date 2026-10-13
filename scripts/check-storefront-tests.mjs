// A convenção de teste do storefront — e a promessa de que o runner vê o mesmo.
// Spec fora de `__tests__/<alvo>.unit.spec.ts` (unidade, colada no que testa) e
// de `src/__checks__/<nome>.spec.ts` (guarda de arquitetura) reprova; o baseline
// guarda os que ainda estão soltos (o F3 os move). Convenção e baseline: doc 15.

//   node scripts/check-storefront-tests.mjs
//   STOREFRONT_RUNNER=1 node scripts/check-storefront-tests.mjs   (o `make test`:
//   pergunta ao vitest o que ele vai rodar e compara com o disco)
//
// Sem framework e sem `node_modules` no modo padrão, como as outras guardas.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { walk } from "./lib/imports.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const FRONTEND = join(root, "frontend")
const SRC = join(FRONTEND, "src")
const BASELINE = join(here, "baselines", "storefront-tests.json")

const SPEC = /\.spec\.tsx?$/
const UNIT = /\/__tests__\/[^/]+\.unit\.spec\.tsx?$/
const CHECKS = /^frontend\/src\/__checks__\/[^/]+\.spec\.tsx?$/

const repoPath = (path) => relative(root, path).split("\\").join("/")
const specs = walk(SRC, [".ts", ".tsx"]).map(repoPath).filter((path) => SPEC.test(path)).sort()

const failures = []

if (specs.length === 0) {
  console.log("  FAIL nenhum teste encontrado em frontend/src")
  console.log("       Um pacote sem teste passa por aqui em silêncio.")
  process.exit(1)
}

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, "utf8")).grandfathered
  : []

for (const spec of specs) {
  if (UNIT.test(spec) || CHECKS.test(spec) || baseline.includes(spec)) continue

  failures.push(
    `${spec}: fora da convenção — mova para ` +
      `${spec.replace(SPEC, ".unit.spec.ts").replace(/^frontend\/src\//, "frontend/src/__tests__/")} ` +
      "(ou `frontend/src/__checks__/<nome>.spec.ts`, se for guarda de arquitetura)"
  )
}

for (const stale of baseline.filter((path) => !specs.includes(path))) {
  failures.push(`${stale}: entrada órfã do baseline (o spec mudou de lugar) — remova do baseline`)
}

// Um `include`/`exclude` no vitest estreita o glob padrão — que é justamente o
// que faz o spec deixar de rodar sem ninguém ver (o defeito que o CRM teve).
const config = readFileSync(join(FRONTEND, "vitest.config.ts"), "utf8")

if (/^\s*(include|exclude)\s*:/m.test(config)) {
  failures.push(
    "frontend/vitest.config.ts: `include`/`exclude` estreita o glob padrão — um spec " +
      "deixaria de rodar em silêncio; use a convenção de `__tests__`/`__checks__`"
  )
}

if (process.env.STOREFRONT_RUNNER === "1") {
  const output = execFileSync(join(FRONTEND, "node_modules", ".bin", "vitest"), ["list"], {
    cwd: FRONTEND,
    encoding: "utf8",
  })

  const seen = [
    ...new Set(
      output
        .split("\n")
        .map((line) => line.split(" > ")[0].trim())
        .filter((line) => /^src\/.*\.spec\.tsx?$/.test(line))
        .map((path) => `frontend/${path}`)
    ),
  ].sort()

  for (const spec of specs.filter((path) => !seen.includes(path))) {
    failures.push(`${spec}: está no disco e o vitest não o lista (ele não vai rodar)`)
  }

  for (const spec of seen.filter((path) => !specs.includes(path))) {
    failures.push(`${spec}: o vitest lista um arquivo fora de frontend/src`)
  }

  console.log(`  ok   o runner vê ${seen.length} arquivo(s) de teste, o disco tem ${specs.length}`)
}

if (failures.length > 0) {
  console.log("")
  for (const failure of failures) console.log(`  FAIL ${failure}`)
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log("Convenção e baseline: docs/real-valor/15-arquitetura-modular.md")
  process.exit(1)
}

console.log(
  `  ok   ${specs.length - baseline.length} spec(s) na convenção, ` +
    `${baseline.length} no baseline (o F3 zera)`
)
