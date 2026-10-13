// A catraca do comentário: o volume de narrativa do repositório só desce.
// A política (cabeçalho ≤5 linhas, densidade ≤12%) e o porquê estão no doc 15;
// `--report` alimenta o F10 e `--write` reancora o baseline quando a forma dos
// arquivos muda de propósito — é parte do commit que a muda.

//   node scripts/check-comments.mjs            (confere)
//   node scripts/check-comments.mjs --report   (os piores, por densidade e volume)
//   node scripts/check-comments.mjs --write    (regrava scripts/baselines/comments.json)
//
// Sem framework e sem `node_modules` de propósito, como as outras guardas.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { commentStats } from "./lib/comments.mjs"
import { walk } from "./lib/imports.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const BASELINE = join(here, "baselines", "comments.json")

/** As árvores de fonte do repositório, uma a uma (o total de cada uma importa). */
const SCOPES = [
  "frontend/src",
  "admin/src",
  "backend/src",
  "packages/contrato/src",
  "scripts",
]

/** `.css` entra porque `brand.css` é fonte com narrativa; `.sh` fica de fora (`#`). */
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".css"]

/** Densidade máxima de um arquivo que NÃO está no baseline, com um piso. */
const CEILING = 0.12
const FLOOR = 6

/** Linhas do primeiro bloco de comentário, antes da primeira linha de código. */
const HEADER_MAX = 5

/** Folga tolerada antes de o baseline ser considerado frouxo (o Prettier mexe). */
const SLACK_RATIO = 0.1
const SLACK_MIN = 3

const mode = process.argv[2]

function capFor(lines) {
  return Math.max(FLOOR, Math.ceil(lines * CEILING))
}

/** `{ files: { caminho: stats }, scopes: { árvore: { lines, comments } } }`. */
function measure() {
  const files = {}
  const scopes = {}

  for (const scope of SCOPES) {
    let lines = 0
    let comments = 0

    for (const file of walk(join(root, scope), EXTENSIONS)) {
      const stats = commentStats(readFileSync(file, "utf8"))
      const path = relative(root, file).split("\\").join("/")

      files[path] = stats
      lines += stats.lines
      comments += stats.comments
    }

    scopes[scope] = { lines, comments }
  }

  return { files, scopes }
}

const current = measure()

if (mode === "--write") {
  const entries = {}
  const scopes = {}

  for (const scope of SCOPES) {
    let comments = 0
    let lines = 0

    for (const [path, stats] of Object.entries(current.files)) {
      if (!path.startsWith(`${scope}/`)) continue

      lines += stats.lines
      comments += stats.comments

      const headerCap = stats.header === null ? HEADER_MAX : stats.header

      if (stats.comments > capFor(stats.lines) || headerCap > HEADER_MAX) {
        entries[path] = {
          comments: stats.comments,
          lines: stats.lines,
          header: headerCap,
        }
      }
    }

    scopes[scope] = { lines, comments }
  }

  mkdirSync(dirname(BASELINE), { recursive: true })
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note:
          "Catraca do comentário (scripts/check-comments.mjs). Só DESCE: entrada " +
          "frouxa (≥10%) ou órfã reprova a guarda. `--write` quando a forma dos " +
          "arquivos mudar de propósito. Política: docs/real-valor/15-arquitetura-modular.md",
        ceiling: CEILING,
        floor: FLOOR,
        headerMax: HEADER_MAX,
        scopes,
        files: entries,
      },
      null,
      2
    )}\n`
  )

  console.log(
    `  ok   baseline regravado: ${Object.keys(entries).length} arquivo(s) acima da política`
  )
  for (const [scope, totals] of Object.entries(scopes)) {
    console.log(`       ${scope}: ${totals.comments} linha(s) de comentário em ${totals.lines}`)
  }
  process.exit(0)
}

if (mode === "--report") {
  const measured = Object.entries(current.files)
    .map(([path, stats]) => ({
      path,
      ...stats,
      density: stats.comments / Math.max(stats.lines, 1),
    }))
    .filter((entry) => entry.comments > 0)

  console.log("\n  Volume (top 15):")
  for (const entry of [...measured].sort((a, b) => b.comments - a.comments).slice(0, 15)) {
    console.log(
      `    ${String(entry.comments).padStart(4)} coment  ${String(entry.lines).padStart(5)} linhas  ` +
        `${(entry.density * 100).toFixed(0).padStart(3)}%  ${entry.path}`
    )
  }

  console.log("\n  Densidade (top 15, ≥40 linhas):")
  for (const entry of [...measured]
    .filter((entry) => entry.lines >= 40)
    .sort((a, b) => b.density - a.density)
    .slice(0, 15)) {
    console.log(
      `    ${(entry.density * 100).toFixed(0).padStart(3)}%  ${String(entry.comments).padStart(4)} coment  ` +
        `${String(entry.lines).padStart(5)} linhas  ${entry.path}`
    )
  }

  console.log("")
  for (const [scope, totals] of Object.entries(current.scopes)) {
    console.log(
      `    ${scope}: ${totals.comments} linha(s) de comentário em ${totals.lines} ` +
        `(${((totals.comments / Math.max(totals.lines, 1)) * 100).toFixed(1)}%)`
    )
  }
  console.log("")
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.log("  FAIL a catraca do comentário não tem baseline")
  console.log("       Rode: node scripts/check-comments.mjs --write")
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"))
const failures = []

for (const [path, entry] of Object.entries(baseline.files)) {
  const stats = current.files[path]

  if (!stats) {
    failures.push(`${path}: entrada órfã (o arquivo não existe mais) — remova do baseline`)
    continue
  }

  if (stats.comments > entry.comments) {
    failures.push(
      `${path}: ${stats.comments} linha(s) de comentário (baseline ${entry.comments}) — ` +
        "a narrativa vai para docs/real-valor/15-arquitetura-modular.md"
    )
    continue
  }

  const slack = entry.comments - stats.comments

  if (slack >= Math.max(SLACK_MIN, Math.ceil(entry.comments * SLACK_RATIO))) {
    failures.push(
      `${path}: baseline frouxo em ${slack} linha(s) (tem ${stats.comments}, o baseline diz ` +
        `${entry.comments}) — aperte com \`--write\`: a catraca só desce`
    )
  }
}

for (const [path, stats] of Object.entries(current.files)) {
  if (baseline.files[path]) continue

  const cap = capFor(stats.lines)

  if (stats.comments > cap) {
    failures.push(
      `${path}: ${stats.comments} linha(s) de comentário em ${stats.lines} (teto ${cap} = ` +
        `${CEILING * 100}%) — arquivo novo não herda a exceção de ninguém`
    )
  }

  if (stats.header !== null && stats.header > HEADER_MAX) {
    failures.push(`${path}: cabeçalho de ${stats.header} linha(s) (máximo ${HEADER_MAX})`)
  }
}

for (const [scope, totals] of Object.entries(baseline.scopes)) {
  const now = current.scopes[scope]

  if (!now) continue

  if (now.comments > totals.comments) {
    failures.push(
      `${scope}: ${now.comments} linha(s) de comentário (baseline ${totals.comments}) — ` +
        "o total da árvore também só desce"
    )
  } else {
    console.log(`  ok   ${scope}: ${now.comments} comentário(s) (baseline ${totals.comments})`)
  }
}

if (failures.length > 0) {
  console.log("")
  for (const failure of failures) console.log(`  FAIL ${failure}`)
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log("Política e calibração: docs/real-valor/15-arquitetura-modular.md")
  process.exit(1)
}

console.log(
  `  ok   comentário sob controle: ${Object.keys(baseline.files).length} arquivo(s) no baseline`
)
