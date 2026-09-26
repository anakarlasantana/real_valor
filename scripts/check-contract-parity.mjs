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
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs"
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
const APPEARANCE = join(root, "frontend/src/lib/content/appearance.ts")
const BRAND_CSS = join(root, "frontend/src/styles/brand.css")
const ADMIN_FIELD_INPUT = join(
  root,
  "backend/src/admin/routes/content/field-input.tsx"
)
/**
 * A página do editor e o CSS dos controles de aparência. A página é quem
 * decide onde o trilho é desenhado (percorrendo a ordem do contrato) e quem
 * avisa a regra do fundo escuro; o CSS é quem declara o `@font-face` das
 * fontes da prévia.
 */
const ADMIN_PAGE = join(root, "backend/src/admin/routes/content/page.tsx")
const APPEARANCE_CSS = join(
  root,
  "backend/src/admin/routes/content/appearance.css"
)
const ADMIN_CONTENT_ROUTE = join(root, "backend/src/api/admin/content/route.ts")
/**
 * As fontes da prévia: `THEME_FONTS` diz a família e a pilha, mas quem
 * entrega os bytes ao navegador do painel é o `@font-face` do
 * `appearance.css` apontando para a cópia local. Conferir a família sem
 * conferir o arquivo deixaria passar a pior falha possível — a prévia
 * desenhada numa fonte que ninguém está vendo.
 */
const ADMIN_FONTS = join(root, "backend/src/admin/routes/content/fonts")
const STOREFRONT_FONTS = join(root, "frontend/src/app/fonts")
/** O tema padrão: de onde saem os hex e as famílias que o admin exibe. */
const THEME_JSON = join(root, "frontend/themes/default/theme.json")
/** `themeToCSSVariables`: de onde sai a pilha completa de cada fonte. */
const THEME_TS = join(root, "frontend/src/lib/theme.ts")
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
 * Onde as classes `.rv-section-*` do `brand.css` podem ser usadas: o
 * wrapper da home, o layout (barra de anúncio) e os componentes das
 * seções. É o que a guarda da aparência varre — uma classe definida e
 * nunca usada é CSS morto, e uma classe usada e nunca definida é uma
 * escolha do lojista que não chega na tela.
 */
const STOREFRONT_DIRS = [
  join(root, "frontend/src/app"),
  join(root, "frontend/src/modules"),
]

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

/** Caminhos de arquivo com uma das extensões, em recursão. */
function walk(dir, extensions) {
  const found = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      found.push(...walk(path, extensions))
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(path)
    }
  }

  return found
}

/** Nomes distintos de um `captura` em todas as ocorrências do texto. */
function readMatches(source, pattern, group = 1) {
  return [
    ...new Set([...source.matchAll(pattern)].map((match) => match[group])),
  ]
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
        // `group` e `optionLabels` também são renderizados pelo admin (que
        // lê o `schema`), então divergir aqui muda a tela: um campo cai no
        // grupo errado ou o `<select>` mostra a chave crua ("dourado" em
        // vez de "Dourado Rosé").
        group: f.group ?? "",
        optionLabels: f.optionLabels ?? {},
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

// O outro lado do mesmo problema: um `kind` que não é lista e que o
// `FieldInput` não trata cai no ramo de texto — um campo de escolha vira
// caixa de digitação livre, e o lojista digita o que o `validateData` vai
// reprovar. `"text"` é o ramo padrão de propósito, então ele fica de fora.
const scalarKinds = [
  ...new Set(
    Object.values(sourceFields)
      .flat()
      .map((f) => f.kind)
  ),
].filter((kind) => !kind.startsWith("list:") && kind !== "text")

for (const kind of scalarKinds) {
  assert(
    `"${kind}" tem ramo no FieldInput`,
    adminSource.includes(`spec.kind === "${kind}"`),
    "acrescente o ramo em " + "backend/src/admin/routes/content/field-input.tsx"
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

// A página do editor monta os trilhos percorrendo os campos na ordem do
// contrato, e cada campo de aparência carrega a âncora (`attachedTo`) do que
// veste. É um espelho do `FieldSpec` do contrato, então a assinatura importa
// no mesmo sentido de `ITEM_FIELDS`: sem ela o TypeScript deixa passar um
// `page.tsx` que lê `spec.attachedTo` de um tipo que não tem, e o editor
// desenha a âncora "por acaso" — até alguém mexer no espelho.
assert(
  'o espelho de "FieldSpec" no admin conhece "attachedTo"',
  /attachedTo\?:\s*string/.test(adminSource),
  "acrescente o campo em backend/src/admin/routes/content/field-input.tsx"
)

console.log("\nAPARÊNCIA POR SEÇÃO (contrato ⇔ espelho ⇔ loja)")

// Os valores válidos (paleta e papéis de fonte) têm duas cópias, uma por
// pacote. A terceira ponta — o `<select>` do admin — não guarda cópia
// nenhuma, de propósito: as opções chegam prontas no `schema` da API, para
// não haver mais uma lista a dessincronizar.
const contractColors = loadExport(CONTRACT, "THEME_COLOR_TOKENS")
const mirrorColors = loadExport(MIRROR, "THEME_COLOR_TOKENS", true)
const contractFonts = loadExport(CONTRACT, "FONT_ROLES")
const mirrorFonts = loadExport(MIRROR, "FONT_ROLES", true)
const contractDark = loadExport(CONTRACT, "THEME_DARK_TOKENS")
const mirrorDark = loadExport(MIRROR, "THEME_DARK_TOKENS", true)
const contractGroups = loadExport(CONTRACT, "APPEARANCE_GROUPS")
const mirrorGroups = loadExport(MIRROR, "APPEARANCE_GROUPS", true)

assert(
  "as cores do tema são as mesmas no contrato e no espelho",
  JSON.stringify(contractColors) === JSON.stringify(mirrorColors),
  `backend: ${contractColors.join(", ")}\n` +
    `       frontend: ${mirrorColors.join(", ")}`
)

assert(
  "os papéis de fonte são os mesmos no contrato e no espelho",
  JSON.stringify(contractFonts) === JSON.stringify(mirrorFonts),
  `backend: ${contractFonts.join(", ")}\n` +
    `       frontend: ${mirrorFonts.join(", ")}`
)

assert(
  "os rótulos dos trilhos de aparência são os mesmos nos dois lados",
  contractGroups.length > 0 &&
    JSON.stringify(contractGroups) === JSON.stringify(mirrorGroups),
  `backend: ${contractGroups.join(", ")}\n` +
    `       frontend: ${mirrorGroups.join(", ")}`
)

// `THEME_DARK_TOKENS` não alimenta `<select>` nenhum: é a lista que o
// storefront usa para auto-legibilizar fundo escuro. Uma cor aqui que não
// esteja na paleta seria uma regra que nunca dispara (ou pior: um token
// que não existe, e a seção fica sem texto).
assert(
  "as cores de fundo escuro são as mesmas no contrato e no espelho",
  JSON.stringify(contractDark) === JSON.stringify(mirrorDark),
  `backend: ${contractDark.join(", ")}\n` +
    `       frontend: ${mirrorDark.join(", ")}`
)

assert(
  "toda cor de fundo escuro é uma cor da paleta do tema",
  contractDark.length > 0 &&
    contractDark.every((token) => contractColors.includes(token)),
  `fora da paleta: ${
    contractDark
      .filter((token) => !contractColors.includes(token))
      .join(", ") || "nenhuma"
  }`
)

const appearanceSource = readFileSync(APPEARANCE, "utf8")
const brandCss = readFileSync(BRAND_CSS, "utf8")

const appearanceSpecs = Object.values(sourceFields)
  .flat()
  .filter((field) => field.name.startsWith("appearance"))
const appearanceFields = [
  ...new Set(appearanceSpecs.map((field) => field.name)),
]

assert(
  "SECTION_FIELDS declara campos de aparência",
  appearanceFields.length > 0,
  'nenhum campo começando com "appearance" foi encontrado'
)

// O trilho: o campo é `color` ou `font` (a lista fechada que a bolinha e a
// lista de fontes desenham), a opção vazia está na frente — é ela que o
// botão "Padrão do tema" grava, e é o que faz a seção voltar a seguir o
// tema sem apagar o campo — e o `group` é um dos rótulos do contrato.
//
// `kind: "select"` aqui seria a falha que ninguém vê: o campo cairia no
// ramo genérico, o lojista veria uma caixa de texto livre e o
// `validateData` reprovaria o que ele digitar.
const offPattern = appearanceSpecs.filter(
  (field) =>
    (field.kind !== "color" && field.kind !== "font") ||
    field.options?.[0] !== "" ||
    !contractGroups.includes(field.group) ||
    !field.attachedTo
)

assert(
  "todo campo de aparência é color/font, com o padrão na frente, em um trilho",
  appearanceSpecs.length > 0 && offPattern.length === 0,
  `fora do padrão: ${
    offPattern
      .map((f) => `${f.name} (${f.kind} / ${f.group ?? "sem trilho"})`)
      .join(", ") || "nenhum"
  }`
)

// A lista de opções é a paleta ou os papéis de fonte — nada além. Um papel
// fora da paleta passaria pela validação e viraria uma escolha que o
// storefront ignora em silêncio (`appearanceVars` descarta valor fora da
// lista): a pior falha de um controle de aparência, porque parece que
// funcionou.
const expectedOptions = (field) =>
  JSON.stringify([
    "",
    ...(field.kind === "color" ? contractColors : contractFonts),
  ])
const offPalette = appearanceSpecs.filter(
  (field) => JSON.stringify(field.options ?? []) !== expectedOptions(field)
)

assert(
  "as opções de cor são a paleta e as de fonte são os papéis, na ordem",
  appearanceSpecs.length > 0 && offPalette.length === 0,
  `fora da lista: ${
    offPalette.map((f) => f.name).join(", ") || "nenhum"
  }\n       ` +
    `cor: , ${contractColors.join(", ")} | fonte: , ${contractFonts.join(", ")}`
)

// O `attachedTo` é a promessa de "aparece embaixo do campo que muda", e é
// verificável: a âncora é o último campo de conteúdo antes do trilho na
// mesma lista. Sem esta guarda, um `spread` fora de lugar empurra o trilho
// três campos para baixo — ou para a seção vizinha — e nada quebra: é a
// diferença entre a fonte do título ficar embaixo do título e de ficar solta
// no fim do formulário.
const anchorProblems = []

for (const [type, fields] of Object.entries(sourceFields)) {
  let lastContentField = null

  for (const field of fields) {
    if (field.name.startsWith("appearance")) {
      if (field.attachedTo !== lastContentField) {
        anchorProblems.push(
          `${type}.${field.name} aponta para ` +
            `${field.attachedTo ?? "(nada)"} em vez de ` +
            `${lastContentField ?? "(início da seção)"}`
        )
      }
      continue
    }

    lastContentField = field.name
  }
}

assert(
  "todo trilho fica logo abaixo do campo de conteúdo que ele veste",
  appearanceSpecs.length > 0 && anchorProblems.length === 0,
  `fora de lugar: ${anchorProblems.join(" | ") || "nenhum"}`
)

const untranslated = appearanceSpecs.filter(
  (field) =>
    typeof field.optionLabels?.[""] !== "string" ||
    (field.options ?? []).some(
      (option) => typeof field.optionLabels?.[option] !== "string"
    )
)

assert(
  "todo campo de aparência traduz cada uma das opções",
  appearanceSpecs.length > 0 && untranslated.length === 0,
  `sem rótulo: ${untranslated.map((f) => f.name).join(", ") || "nenhum"}`
)

// O storefront precisa LER cada campo oferecido: campo que o admin mostra e
// a loja ignora é o pior tipo de campo, porque parece que funcionou. A
// leitura é textual porque o contrato é TS: importá-lo aqui só para isso
// seria mais uma ponta para o `validateData` ter de conhecer.
const appearanceReads = readMatches(
  appearanceSource,
  /source\.([A-Za-z_$][\w$]*)/g
)

assert(
  "todo campo de aparência do contrato é lido pelo storefront",
  appearanceFields.length > 0 &&
    appearanceFields.every((name) => appearanceReads.includes(name)),
  "sem leitura em frontend/src/lib/content/appearance.ts: " +
    `${appearanceFields.filter((n) => !appearanceReads.includes(n)).join(", ")}`
)

assert(
  "appearance.ts não lê campo que o contrato não declara",
  appearanceReads.length > 0 &&
    appearanceReads.every((name) => appearanceFields.includes(name)),
  `fora do contrato: ${
    appearanceReads.filter((n) => !appearanceFields.includes(n)).join(", ") ||
    "nenhum"
  }`
)

// A outra metade da ponte: cada variável que `appearanceVars` escreve no
// wrapper precisa de um `var()` no `brand.css`. Uma variável escrita e não
// consumida é uma escolha que o lojista faz e nada aplica.
const writtenVars = readMatches(appearanceSource, /--rv-section[a-z-]*/g, 0)
const consumedVars = readMatches(brandCss, /var\((--rv-section[a-z-]*)/g)

assert(
  "toda variável de aparência escrita é consumida no brand.css",
  writtenVars.length > 0 &&
    writtenVars.every((name) => consumedVars.includes(name)),
  `sem uso: ${
    writtenVars.filter((name) => !consumedVars.includes(name)).join(", ") ||
    "nenhuma"
  }`
)

// E as classes, nas duas direções: uma definida e nunca usada é CSS morto
// (ninguém lembra de apagar), e uma usada e nunca definida é um erro de
// digitação que não dá erro em lugar nenhum — só a seção sem a cor.
const storefrontSource = STOREFRONT_DIRS.flatMap((dir) => walk(dir, [".tsx"]))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")

const definedClasses = readMatches(brandCss, /^\.(rv-section[a-z-]*)[ ,{]/gm)
const usedClasses = readMatches(
  storefrontSource,
  // `(?:-[a-z]+)*` (e não `[a-z-]*`) para um comentário que escreve o prefixo
  // — "as classes `.rv-section-*` do brand.css" — casar `rv-section`, e não
  // um "rv-section-" que não é classe nenhuma.
  /\brv-section(?:-[a-z]+)*/g,
  0
)

assert(
  "toda classe de aparência definida é usada na loja",
  definedClasses.length > 0 &&
    definedClasses.every((name) => usedClasses.includes(name)),
  `CSS morto: ${
    definedClasses.filter((name) => !usedClasses.includes(name)).join(", ") ||
    "nenhuma"
  }`
)

assert(
  "toda classe de aparência usada está definida no brand.css",
  usedClasses.length > 0 &&
    usedClasses.every((name) => definedClasses.includes(name)),
  `sem definição: ${
    usedClasses.filter((name) => !definedClasses.includes(name)).join(", ") ||
    "nenhuma"
  }`
)

console.log("\nPRÉVIA DE APARÊNCIA (paleta, fontes e os arquivos do painel)")

const contractHexes = loadExport(CONTRACT, "THEME_COLOR_HEXES")
const mirrorHexes = loadExport(MIRROR, "THEME_COLOR_HEXES", true)
const contractThemeFonts = loadExport(CONTRACT, "THEME_FONTS")
const mirrorThemeFonts = loadExport(MIRROR, "THEME_FONTS", true)

assert(
  "a paleta de prévia é a mesma no contrato e no espelho",
  JSON.stringify(contractHexes) === JSON.stringify(mirrorHexes),
  "o hex que o painel desenha precisa ser o mesmo dos dois lados"
)

assert(
  "as famílias de fonte são as mesmas no contrato e no espelho",
  JSON.stringify(contractThemeFonts) === JSON.stringify(mirrorThemeFonts),
  "a prévia de uma ponta e a da outra precisam ser a mesma fonte"
)

// O hex é cópia de leitura do tema padrão (`themes/default/theme.json`).
// Um tema de estação troca os valores — a cópia mostra a cor do padrão, e o
// contrato avisa isso —, mas o **padrão** é o que a bolinha promete, então
// é contra ele que a cópia é conferida.
const theme = JSON.parse(readFileSync(THEME_JSON, "utf8"))
const offThemeColors = contractColors.filter(
  (token) =>
    (contractHexes[token] ?? "").toLowerCase() !==
    String(theme.colors?.[token] ?? "").toLowerCase()
)

assert(
  "cada hex da paleta é o que o theme.json do tema padrão declara",
  offThemeColors.length === 0,
  `divergente: ${
    offThemeColors
      .map(
        (token) =>
          `${token}: ${contractHexes[token]} != ${theme.colors?.[token]}`
      )
      .join(", ") || "nenhuma"
  }`
)

const offThemeFamilies = contractFonts.filter(
  (role) => contractThemeFonts[role]?.family !== theme.fonts?.[role]
)

assert(
  "cada família é a que o theme.json do tema padrão declara",
  offThemeFamilies.length === 0,
  `divergente: ${offThemeFamilies.join(", ") || "nenhuma"}`
)

// A `stack` é a pilha que `themeToCSSVariables` escreve em `--rv-font-*`: a
// mesma da loja, para a prévia cair no mesmo fallback quando o arquivo da
// fonte não chega. O texto é lido do próprio `theme.ts` — a comparação é
// com a fórmula da loja, não com uma reescrita do que ela diz.
const themeTs = readFileSync(THEME_TS, "utf8")
const offStacks = contractFonts.filter((role) => {
  const declared = contractThemeFonts[role]?.stack
  // `--rv-font-display`: `"${theme.fonts.display}", Georgia, serif`
  // O grupo é o que vem **depois** do fechamento do `}` — a aspa de fim de
  // família e o fallback, para a pilha ser remontada a partir da fórmula da
  // loja e não de uma reescrita dela.
  const template = new RegExp(
    `"--rv-font-${role}":\\s*\`"\\$\\{theme\\.fonts\\.${role}\\}([^\`]*)\``
  ).exec(themeTs)

  return (
    !template ||
    `"${contractThemeFonts[role]?.family}${template[1]}` !== declared
  )
})

assert(
  "cada pilha de fonte é a que o theme.ts escreve para a loja",
  offStacks.length === 0,
  `divergente: ${offStacks.join(", ") || "nenhuma"}`
)

// O `@font-face` é quem entrega os bytes ao navegador do painel. Conferir a
// família sem conferir o arquivo deixaria passar a pior falha possível: a
// prévia desenhada numa fonte que o painel não tem — que é o que acontece
// quando o nome está certo e o arquivo sumiu.
const appearanceCss = readFileSync(APPEARANCE_CSS, "utf8")
const cssFamilies = readMatches(
  appearanceCss,
  /@font-face\s*\{[^}]*font-family:\s*"([^"]+)"[\s\S]*?\}/g
)
const expectedFamilies = contractFonts.map(
  (role) => contractThemeFonts[role]?.family
)

assert(
  "o appearance.css declara @font-face para cada família, apontando para ./fonts",
  cssFamilies.length === expectedFamilies.length &&
    expectedFamilies.every((family) => cssFamilies.includes(family)) &&
    // Nenhuma `@font-face` sem arquivo local: fonte vinda de CDN é a que o
    // storefront deixou de usar (ver `frontend/src/app/fonts/README.md`).
    // Conta **declarações** (`@font-face {`), não menções — o cabeçalho do
    // arquivo fala delas.
    (appearanceCss.match(/@font-face\s*\{/g) ?? []).length ===
      expectedFamilies.length &&
    (appearanceCss.match(/url\("\.\/fonts\/[^"]+"\)/g) ?? []).length ===
      expectedFamilies.length,
  `no css: ${cssFamilies.join(", ") || "nenhuma"} | ` +
    `esperado: ${expectedFamilies.join(", ")}`
)

// E o arquivo apontado precisa ser a mesma fonte da loja: o painel é outro
// pacote, com a cópia local dos `.woff2`, e cópia desatualizada é prévia que
// mente sobre a fonte que a loja está usando. O diretório do storefront é o
// nome da família em minúsculas com hífen — o mesmo que
// `src/app/fonts/README.md` documenta.
const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex")
const fontProblems = []

for (const family of expectedFamilies) {
  const slug = String(family)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
  const file = `${slug}-latin.woff2`
  const storefront = join(STOREFRONT_FONTS, slug, file)
  const admin = join(ADMIN_FONTS, file)

  if (!existsSync(storefront)) {
    fontProblems.push(`${file}: não achei em ${storefront}`)
  } else if (!existsSync(admin)) {
    fontProblems.push(`${file}: não achei a cópia em ${admin}`)
  } else if (md5(storefront) !== md5(admin)) {
    fontProblems.push(`${file}: md5 ${md5(admin)} != ${md5(storefront)}`)
  }
}

assert(
  "os .woff2 do painel são os mesmos do storefront (md5)",
  fontProblems.length === 0,
  fontProblems.join("; ")
)

// O aviso do fundo escuro é a única coisa que a página precisa nomear do
// contrato: o trilho em que vale. Rótulo trocado no contrato e não aqui
// deixaria o aviso apontando para o nada — silenciosamente, porque o aviso
// simplesmente nunca aparece.
const adminPage = readFileSync(ADMIN_PAGE, "utf8")
const backgroundRail = /const BACKGROUND_RAIL = "([^"]+)"/.exec(adminPage)?.[1]

assert(
  "o trilho do aviso de fundo escuro existe no contrato",
  contractGroups.includes(backgroundRail),
  `página: ${backgroundRail ?? "(não lido)"} | ` +
    `contrato: ${contractGroups.join(", ")}`
)

// O painel não importa o contrato, então o hex e a família chegam pelo
// `schema` da API. Se o `schema` deixar de mandá-los, a bolinha sai sem cor e
// a lista de fontes cai no fallback do navegador — que é o erro que a prévia
// não tem como esconder, porque ainda "funciona".
const adminRoute = readFileSync(ADMIN_CONTENT_ROUTE, "utf8")
const schemaKeys = [
  "palette: THEME_COLOR_HEXES",
  "fonts: THEME_FONTS",
  "darkTokens: THEME_DARK_TOKENS",
]
const offSchema = schemaKeys.filter((key) => !adminRoute.includes(key))

assert(
  "GET /admin/content devolve paleta, fontes e cores escuras no schema",
  offSchema.length === 0,
  `faltando no schema: ${offSchema.join(", ") || "nenhum"}`
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
