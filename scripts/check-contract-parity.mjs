/**
 * Guarda de paridade do contrato de conteúdo.
 * -----------------------------------------------------------------
 * O contrato existe em dois lugares, porque backend e frontend são
 * pacotes npm separados:
 *
 *   backend/src/modules/content/contract.ts   (fonte da verdade)
 *   frontend/src/lib/content/home-sections.ts (espelho)
 *
 * Este script compara os dois e falha (exit 1) se divergirem.
 *
 * Também verifica que `backend/src/modules/content/defaults.ts` cobre
 * todos os tipos de seção, para o seed nunca gravar uma home incompleta.
 *
 * Rode com:
 *   node scripts/check-contract-parity.mjs
 *
 * Não usa framework de teste de propósito: o frontend não tem runner
 * instalado e adicionar um só para isto seria peso morto. Roda no Node
 * 24, que carrega TypeScript nativamente.
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const CONTRACT = join(root, "backend/src/modules/content/contract.ts")
const OVERRIDE = join(root, "backend/src/modules/content/index.ts")
const MIRROR = join(root, "frontend/src/lib/content/home-sections.ts")
const DEFAULTS = join(root, "backend/src/modules/content/defaults.ts")
const PARITY_DIR = join(
  root,
  "frontend/src/lib/content/__parity__"
)

/**
 * Carrega um módulo TS e devolve o valor de um export.
 *
 * `CONTRACT_BYPASS=1` evita o ciclo de resolução do `index.ts` do
 * módulo do Medusa: quando o override é o próprio `index.ts`, esse
 * arquivo importa o `service`, que importa `@medusajs/framework/utils`.
 * O contrato não tem dependências de runtime, só tipos.
 */
function loadExport(file, exportName, bypass = false) {
  const dir = mkdtempSync(join(tmpdir(), "rv-parity-"))
  const entry = join(dir, "entry.mjs")

  const specifier = `file://${file}`
  const body = `
    ${bypass ? "process.env.CONTRACT_BYPASS = \"1\";" : ""}
    const mod = await import(${JSON.stringify(specifier)});
    const value = mod[${JSON.stringify(exportName)}];
    if (value === undefined) {
      console.error("__MISSING__:" + ${JSON.stringify(exportName)});
      process.exit(3);
    }
    process.stdout.write(JSON.stringify(value));
  `

  const written = spawnSync(
    "bash",
    ["-c", `cat > ${JSON.stringify(entry)} <<'RVEOF'\n${body}\nRVEOF`],
    { encoding: "utf8" }
  )
  if (written.status !== 0) {
    rmSync(dir, { recursive: true, force: true })
    throw new Error(`Falha ao preparar o carregador: ${written.stderr}`)
  }

  const result = spawnSync("node", [entry], { encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })

  if (result.status === 3) {
    throw new Error(
      `${file} não exporta "${exportName}". ` +
        `Erro de compilação:\n${result.stderr}`
    )
  }
  if (result.status !== 0) {
    throw new Error(
      `Falha ao importar ${file}:\n${result.stderr || result.stdout}`
    )
  }

  return JSON.parse(result.stdout)
}

const failures = []

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`)
    failures.push(label)
  }
}

console.log("Paridade do contrato de conteúdo\n")

const sourceTypes = loadExport(CONTRACT, "SECTION_TYPES")
const sourceFields = loadExport(CONTRACT, "SECTION_FIELDS")
const mirrorTypes = loadExport(MIRROR, "SECTION_TYPES", true)
const mirrorFields = loadExport(MIRROR, "SECTION_FIELDS", true)

console.log("SECTION_TYPES")
assert(
  "mesma lista de tipos, na mesma ordem",
  JSON.stringify(sourceTypes) === JSON.stringify(mirrorTypes),
  `backend: ${sourceTypes.join(", ")}\n       frontend: ${mirrorTypes.join(", ")}`
)

console.log("\nSECTION_FIELDS")
for (const type of sourceTypes) {
  const a = sourceFields[type] ?? []
  const b = mirrorFields[type] ?? []

  const norm = (fields) =>
    JSON.stringify(
      fields.map((f) => ({
        name: f.name,
        label: f.label,
        kind: f.kind,
        required: Boolean(f.required),
        options: f.options ?? [],
      }))
    )

  assert(
    `"${type}" tem os mesmos campos`,
    norm(a) === norm(b),
    `backend: ${a.map((f) => f.name).join(", ")}\n       frontend: ${b.map((f) => f.name).join(", ")}`
  )
}

console.log("\nDEFAULTS_HOME_SECTIONS")
const defaults = loadExport(DEFAULTS, "DEFAULT_HOME_SECTIONS", true)
const covered = new Set(defaults.map((s) => s.type))

assert(
  "cobre todos os tipos de seção",
  sourceTypes.every((type) => covered.has(type)),
  `faltando: ${sourceTypes.filter((t) => !covered.has(t)).join(", ")}`
)

assert(
  "positions são únicas",
  new Set(defaults.map((s) => s.position)).size === defaults.length,
  `positions: ${defaults.map((s) => s.position).join(", ")}`
)

assert(
  "positions estão em ordem ascendente no arquivo",
  defaults.every(
    (s, i) => i === 0 || s.position > defaults[i - 1].position
  )
)

assert(
  "todo campo obrigatório do contrato está preenchido",
  defaults.every((section) =>
    (sourceFields[section.type] ?? [])
      .filter((f) => f.required)
      .every((f) => {
        const value = section[f.name]
        return value !== undefined && value !== null && value !== ""
      })
  )
)

if (failures.length) {
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log(
    "Atualize o espelho em frontend/src/lib/content/home-sections.ts " +
      "para acompanhar backend/src/modules/content/contract.ts."
  )
  process.exit(1)
}

console.log("\nContrato em paridade.")
