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
const SOCIAL_ICONS = join(root, "frontend/src/lib/content/social-icons.tsx")
const ADMIN_FIELD_INPUT = join(
  root,
  "backend/src/admin/routes/content/field-input.tsx"
)
const FOOTER_COLUMN = join(
  root,
  "frontend/src/modules/layout/components/footer-column/index.tsx"
)
const FOOTER_TEMPLATE = join(
  root,
  "frontend/src/modules/layout/templates/footer/index.tsx"
)
const PARITY_DIR = join(root, "frontend/src/lib/content/__parity__")

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
    ${bypass ? 'process.env.CONTRACT_BYPASS = "1";' : ""}
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

  return match ? parseStringArray(match[1]) : null
}

/**
 * Strings de um literal de array, tolerante a quebra de linha e a vírgula
 * final: o Prettier quebra arrays longos, e o `JSON.parse` do texto cru
 * passaria a falhar (guardas de paridade não podem depender de formatação).
 */
function parseStringArray(inner) {
  const values = [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1])

  return values.length > 0 ? values : null
}

/** Chaves `nome:` de um objeto lido por `readBlock` (ex.: `SOCIAL_ICONS`). */
function readObjectKeys(block) {
  const body = block.slice(block.indexOf("{") + 1, block.lastIndexOf("}"))

  return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1])
}

/** Campos `nome: tipo` de um `export type NOME = { ... }` lido como texto. */
function readTypeFields(source, name) {
  const match = new RegExp(`export type ${name} = \\{([\\s\\S]*?)\\n\\}`).exec(
    source
  )

  return match
    ? [...match[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map((m) => m[1])
    : null
}

/**
 * Nomes dos sub-campos (`name: "x"`) do editor de um `kind` de lista,
 * dentro do bloco `ITEM_FIELDS` de `field-input.tsx`.
 */
function readItemFieldNames(block, kind) {
  const match = new RegExp(`"${kind}"\\s*:\\s*\\[([\\s\\S]*?)\\n  \\]`).exec(
    block
  )

  return match
    ? [...match[1].matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1])
    : null
}

/** Lista literal de strings de um `const NOME = ["a", "b"]`. */
function readStringList(source, name) {
  const match = new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source)

  return match ? parseStringArray(match[1]) : null
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
  `backend: ${sourceTypes.join(", ")}\n       frontend: ${mirrorTypes.join(
    ", "
  )}`
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
    `backend: ${a.map((f) => f.name).join(", ")}\n       frontend: ${b
      .map((f) => f.name)
      .join(", ")}`
  )
}

// A comparação acima usa `?? []`, então um tipo que perde a chave nos dois
// arquivos passa como "tem os mesmos campos". E um tipo sem campos derruba a
// loja: o formulário do admin fica sem nenhum campo para editar, o PATCH
// estoura na validação (500) e o `data` do bloco perde o que o formulário
// não enviar. Foi exatamente o que aconteceu com o `footer`.
for (const type of sourceTypes) {
  const inContract = sourceFields[type]
  const inMirror = mirrorFields[type]

  assert(
    `"${type}" declara campos nos dois arquivos`,
    Array.isArray(inContract) &&
      inContract.length > 0 &&
      Array.isArray(inMirror) &&
      inMirror.length > 0,
    `contrato: ${inContract?.length ?? "SEM A CHAVE"}; ` +
      `espelho: ${inMirror?.length ?? "SEM A CHAVE"}`
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
  defaults.every((s, i) => i === 0 || s.position > defaults[i - 1].position)
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
  `seed: ${JSON.stringify(sourceNav?.links)} ${JSON.stringify(
    sourceNav?.actions
  )}\n` +
    `       fallback: ${JSON.stringify(fallbackHeader.links)} ${JSON.stringify(
      fallbackHeader.actions
    )}`
)

console.log("\nFOOTER (footer: seed \u2194 fallback)")

const sourceFooter = defaults.find((section) => section.type === "footer")
const fallbackFooter = loadExport(MIRROR, "DEFAULT_FOOTER", true)

// Mesma razão do cabeçalho: o seed grava o bloco `footer` e o layout cai
// em `DEFAULT_FOOTER` quando o payload não traz nenhum. Se os dois
// divergirem, a mesma loja mostra um rodapé diferente conforme a semente
// rodou (ou conforme a rede).
const footerShape = (footer) =>
  JSON.stringify({
    columns: footer?.columns ?? [],
    social: footer?.social ?? [],
  })

assert(
  "o footer do seed tem as mesmas colunas e redes do fallback do storefront",
  sourceFooter !== undefined &&
    footerShape(sourceFooter) === footerShape(fallbackFooter),
  `seed: ${footerShape(sourceFooter)}\n` +
    `       fallback: ${footerShape(fallbackFooter)}`
)

// `source` é o que decide se a coluna sai do catálogo ou dos links
// digitados. A lista é espelhada em três lugares (contrato, espelho do
// frontend e admin, que é pacote separado e desenha um `<select>`), então
// ela é conferida — e todo `source` oferecido precisa de um ramo no
// desenho, senão a coluna aparece vazia na loja.
const contractSources = loadExport(CONTRACT, "FOOTER_COLUMN_SOURCES")
const mirrorSources = loadExport(MIRROR, "FOOTER_COLUMN_SOURCES", true)
const footerColumnSource = readFileSync(FOOTER_COLUMN, "utf8")

assert(
  "as origens de coluna são as mesmas no contrato e no espelho",
  JSON.stringify(contractSources) === JSON.stringify(mirrorSources),
  `backend: ${contractSources.join(", ")}\n` +
    `       frontend: ${mirrorSources.join(", ")}`
)

for (const source of contractSources.filter((source) => source !== "links")) {
  assert(
    `a origem "${source}" tem ramo em footer-column/index.tsx`,
    footerColumnSource.includes(`column.source === "${source}"`),
    "acrescente o ramo em " +
      "frontend/src/modules/layout/components/footer-column/index.tsx"
  )
}

// Todo `content.<campo>` lido pelo rodapé precisa existir em
// `SECTION_FIELDS.footer`. Não é preciosismo: o formulário do admin é montado
// a partir dessa lista e o PATCH substitui o `data` inteiro pelo que o
// formulário enviou — então um campo que o render lê mas a lista não declara
// fica sem editor na tela **e** é apagado do banco no primeiro "Salvar".
const footerTemplate = readFileSync(FOOTER_TEMPLATE, "utf8")
const footerReads = [
  ...new Set(
    [...footerTemplate.matchAll(/\bcontent\.([A-Za-z_$][\w$]*)/g)].map(
      (match) => match[1]
    )
  ),
]
const footerSpecFields = (sourceFields.footer ?? []).map((field) => field.name)

assert(
  "todo campo que o rodapé lê tem editor em SECTION_FIELDS.footer",
  footerReads.length > 0 &&
    footerReads.every((name) => footerSpecFields.includes(name)),
  `render lê: ${footerReads.join(", ") || "nenhum"}\n` +
    `       contrato: ${footerSpecFields.join(", ") || "NENHUM"}`
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
  ...new Set(
    Object.values(sourceFields)
      .flat()
      .map((f) => f.kind)
  ),
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

// O registro social vive num `.tsx` (desenha SVG próprio, não usa
// `@medusajs/icons`), então é lido como texto — o type-stripping nativo
// do Node não transforma JSX. `SOCIAL_ICON_KEYS` é a lista declarada e
// `SOCIAL_ICONS` é o mapa; as duas são verificadas, porque uma chave
// oferecida sem entrada no mapa viraria globo genérico na vitrine.
const socialSource = readFileSync(SOCIAL_ICONS, "utf8")
// `export const`: o `readStringList` casa só o `const NOME = [...]`, que é
// o suficiente — e por isso serve para o contrato, para o admin e aqui.
const socialKeys = readStringList(socialSource, "SOCIAL_ICON_KEYS")
const socialMapKeys = readObjectKeys(readBlock(socialSource, "SOCIAL_ICONS"))
const adminSocialKeys = readKeys(iconKeysBlock, "list:social")

assert(
  '"list:social" oferece as mesmas chaves de ícone',
  adminSocialKeys !== null &&
    JSON.stringify(adminSocialKeys) === JSON.stringify(socialKeys),
  `admin: ${adminSocialKeys?.join(", ") ?? "não lido"}\n` +
    `       storefront: ${socialKeys?.join(", ") ?? "não lido"}`
)

assert(
  "toda chave social tem um ícone no registro do storefront",
  Array.isArray(socialKeys) &&
    socialKeys.every((key) => socialMapKeys.includes(key)),
  `sem ícone: ${
    Array.isArray(socialKeys)
      ? socialKeys.filter((key) => !socialMapKeys.includes(key)).join(", ") ||
        "nenhuma"
      : "SOCIAL_ICONS não lido"
  }`
)

// O item de uma coluna do rodapé vive em dois lugares: o tipo
// `FooterColumn` do contrato e o editor `ITEM_FIELDS["list:column"]`.
// Campo só num lado deixa o lojista sem como preencher o que o
// storefront renderiza — e, no caso do `source`, sem como escolher se a
// coluna sai do catálogo ou dos links digitados.
const contractSource = readFileSync(CONTRACT, "utf8")
const contractColumnFields = readTypeFields(contractSource, "FooterColumn")
const adminColumnFields = readItemFieldNames(itemFields, "list:column")

assert(
  "o editor de coluna do rodapé tem os mesmos campos do contrato",
  contractColumnFields !== null &&
    JSON.stringify(adminColumnFields) === JSON.stringify(contractColumnFields),
  `admin: ${adminColumnFields?.join(", ") ?? "não lido"}\n` +
    `       contrato: ${contractColumnFields?.join(", ") ?? "não lido"}`
)

const adminSources = readStringList(adminSource, "FOOTER_COLUMN_SOURCES")

assert(
  '"list:column" oferece as mesmas origens de coluna do contrato',
  adminSources !== null &&
    JSON.stringify(adminSources) === JSON.stringify(contractSources),
  `admin: ${adminSources?.join(", ") ?? "não lido"}\n` +
    `       contrato: ${contractSources.join(", ")}`
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
