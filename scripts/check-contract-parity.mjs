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
 * E que o editor do admin (`backend/src/admin/routes/content/field-input.tsx`)
 * sabe desenhar todo tipo de lista do contrato, com as mesmas chaves de
 * ícone que `frontend/src/lib/content/icons.ts` oferece. São espelhos
 * mantidos à mão — o admin é um pacote separado e não importa nem o
 * contrato nem o registro de ícones —, então é justamente onde a
 * divergência acontece em silêncio (um campo sem editor, um ícone que não
 * desenha).
 *
 * Rode com:
 *   node scripts/check-contract-parity.mjs
 *
 * Não usa framework de teste de propósito: o frontend não tem runner
 * instalado e adicionar um só para isto seria peso morto. Roda no Node
 * 24, que carrega TypeScript nativamente.
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
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
const ICONS = join(root, "frontend/src/lib/content/icons.ts")
const ADMIN_FIELD_INPUT = join(
  root,
  "backend/src/admin/routes/content/field-input.tsx"
)
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

/**
 * Lê o bloco `const NOME = { ... }` de um arquivo texto.
 *
 * `field-input.tsx` é um componente React: importá-lo no Node esbarraria no
 * JSX, que o type-stripping nativo não transforma. Daí a leitura textual —
 * o mesmo motivo pelo qual as listas do admin são espelhadas à mão.
 */
function readBlock(source, name) {
  const match = new RegExp(`const ${name}[\\s\\S]*?\\n\\}`).exec(source)

  return match ? match[0] : ""
}

/** Extrai `"chave": ["a", "b"]` de um bloco; `null` se não achar. */
function readKeys(block, name) {
  const match = new RegExp(`"${name}"\\s*:\\s*\\[([^\\]]*)\\]`).exec(block)

  if (!match) {
    return null
  }

  try {
    return JSON.parse(`[${match[1]}]`)
  } catch {
    return null
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

console.log("\nHEADER (nav: seed \u2194 fallback)")

const sourceNav = defaults.find((section) => section.type === "nav")
const fallbackHeader = loadExport(MIRROR, "DEFAULT_HEADER", true)

// O seed grava o bloco `nav`; quando o payload não traz nenhum, o layout
// cai em `DEFAULT_HEADER`. Se os dois divergirem, a mesma loja mostra um
// cabeçalho diferente conforme a semente rodou (ou conforme a rede).
const headerShape = (nav) =>
  JSON.stringify({ links: nav?.links ?? [], actions: nav?.actions ?? [] })

assert(
  "o nav do seed tem os mesmos links e a\u00e7\u00f5es do fallback do storefront",
  sourceNav !== undefined &&
    headerShape(sourceNav) === headerShape(fallbackHeader),
  `seed: ${JSON.stringify(sourceNav?.links)} ${JSON.stringify(sourceNav?.actions)}\n` +
    `       fallback: ${JSON.stringify(fallbackHeader.links)} ${JSON.stringify(fallbackHeader.actions)}`
)

console.log("\nADMIN (field-input.tsx)")

const adminSource = readFileSync(ADMIN_FIELD_INPUT, "utf8")
const itemFields = readBlock(adminSource, "ITEM_FIELDS")
const iconKeysBlock = readBlock(adminSource, "ICON_KEYS_BY_KIND")

assert("ITEM_FIELDS foi localizado", itemFields !== "")
assert("ICON_KEYS_BY_KIND foi localizado", iconKeysBlock !== "")

// Todo `list:` do contrato precisa de um editor: sem ele o campo aparece
// na tela do admin, mas não dá para preencher. `list:text` é a exceção —
// um input de texto separado por vírgula, sem sub-campos.
const listKinds = [
  ...new Set(Object.values(sourceFields).flat().map((f) => f.kind)),
].filter((kind) => kind.startsWith("list:") && kind !== "list:text")

for (const kind of listKinds) {
  assert(
    `há editor de itens para "${kind}"`,
    itemFields.includes(`"${kind}":`),
    "acrescente o tipo em ITEM_FIELDS (ou trate-o como list:text)"
  )
}

const iconKeysByKind = {
  "list:benefit": loadExport(ICONS, "BENEFIT_ICON_KEYS", true),
  "list:action": loadExport(ICONS, "HEADER_ACTION_ICON_KEYS", true),
}

const knownIcons = new Set(loadExport(ICONS, "AVAILABLE_ICON_KEYS", true))

for (const [kind, expected] of Object.entries(iconKeysByKind)) {
  const found = readKeys(iconKeysBlock, kind)

  assert(
    `"${kind}" oferece as mesmas chaves de ícone`,
    found !== null && JSON.stringify(found) === JSON.stringify(expected),
    `admin: ${found?.join(", ") ?? "não lido"}\n` +
      `       storefront: ${expected.join(", ")}`
  )
}

assert(
  "toda chave de ícone oferecida tem um ícone no registro do storefront",
  Object.values(iconKeysByKind)
    .flat()
    .every((key) => knownIcons.has(key)),
  `sem ícone: ${Object.values(iconKeysByKind)
    .flat()
    .filter((key) => !knownIcons.has(key))
    .join(", ")}`
)

if (failures.length) {
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log(
    "Atualize o espelho em frontend/src/lib/content/home-sections.ts " +
      "para acompanhar backend/src/modules/content/contract.ts."
  )
  console.log(
    "Já as listas do admin espelham frontend/src/lib/content/icons.ts " +
      "(chaves de ícone) e os campos de cada lista do contrato."
  )
  process.exit(1)
}

console.log("\nContrato em paridade.")
