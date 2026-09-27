/**
 * Guarda do contrato de conteúdo.
 * -----------------------------------------------------------------
 * O contrato tem uma fonte só — `backend/src/modules/content/`:
 *
 *   contract.ts   tipos das seções, listas fechadas do tema e o que o
 *                 CRM/admin desenha (`SECTION_FIELDS`, paleta de prévia,
 *                 validação)
 *   defaults.ts   o conteúdo padrão da home (também é o seed)
 *
 * O storefront não guarda cópia: ele compila
 * `frontend/src/lib/content/contract.generated.ts`, que
 * `scripts/gen-content.mjs` escreve a partir daqueles dois arquivos. O
 * artefato é versionado, e este script falha (exit 1) quando ele está
 * desatualizado — contrato novo é editar o backend e rodar o gerador.
 *
 * O resto do que se confere aqui são as pontas que não passam pelo gerador:
 *
 *   - coerência da própria fonte (todo tipo tem campos, os defaults cobrem
 *     todos os tipos, todo campo obrigatório está preenchido no seed, e
 *     obrigatório/`SECTION_FIELDS` batem com o que a loja lê);
 *   - o editor do admin (`backend/src/admin/routes/content/field-input.tsx`)
 *     saber desenhar todo tipo de lista do contrato, com as mesmas chaves de
 *     ícone que `frontend/src/lib/content/icons.ts` oferece. São espelhos
 *     mantidos à mão — o admin é um pacote separado e não importa nem o
 *     contrato nem o registro de ícones —, então é justamente onde a
 *     divergência acontece em silêncio (um campo sem editor, um ícone que não
 *     desenha);
 *   - a aparência: os valores do contrato que o storefront pinta
 *     (`brand.css`, `appearance.ts`) e os arquivos que a prévia do painel
 *     desenha.
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
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const CONTRACT = join(root, "backend/src/modules/content/contract.ts")
const DEFAULTS = join(root, "backend/src/modules/content/defaults.ts")
/** O gerador que produz o artefato do storefront (ver `scripts/gen-content.mjs`). */
const GENERATOR = join(root, "scripts/gen-content.mjs")
/** O artefato que o storefront compila — versionado, gerado. */
const GENERATED = join(root, "frontend/src/lib/content/contract.generated.ts")
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
 * O `import` acontece num processo Node à parte, que apaga os tipos
 * (type-stripping nativo) e devolve o valor serializado por stdout. Só serve
 * para arquivos sem dependência de runtime — `contract.ts`, `defaults.ts` e
 * `icons.ts` são tipos e dados puros.
 */
function loadExport(file, exportName) {
  const dir = mkdtempSync(join(tmpdir(), "rv-parity-"))
  const entry = join(dir, "entry.mjs")

  const body = `
    const mod = await import(${JSON.stringify(`file://${file}`)});
    const value = mod[${JSON.stringify(exportName)}];
    if (value === undefined) {
      console.error("__MISSING__:" + ${JSON.stringify(exportName)});
      process.exit(3);
    }
    process.stdout.write(JSON.stringify(value));
  `

  writeFileSync(entry, body)
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

console.log("Contrato de conteúdo do storefront\n")

// ---------------------------------------------------------------------------
// 1. O ARTEFATO GERADO ESTÁ EM DIA
// ---------------------------------------------------------------------------
// O storefront não tem mais uma cópia digitada do contrato: ele compila
// `frontend/src/lib/content/contract.generated.ts`, gerado de
// `contract.ts` + `defaults.ts`. A sincronia é conferida pelo próprio
// gerador — que compara o arquivo inteiro e diz o comando a rodar —, no
// lugar das ~300 linhas de comparação campo a campo que existiam aqui.
const generated = spawnSync("node", [GENERATOR, "--check"], {
  encoding: "utf8",
})

assert(
  "o contrato gerado do storefront está em dia",
  generated.status === 0,
  (generated.stderr || generated.stdout).trim()
)

const sourceTypes = loadExport(CONTRACT, "SECTION_TYPES")
const sourceFields = loadExport(CONTRACT, "SECTION_FIELDS")
const contractSources = loadExport(CONTRACT, "FOOTER_COLUMN_SOURCES")
const fallbackHeader = loadExport(GENERATED, "DEFAULT_HEADER")
const fallbackFooter = loadExport(GENERATED, "DEFAULT_FOOTER")

console.log("\nSECTION_TYPES ⇔ SECTION_FIELDS")

// Um tipo que existe só num dos dois mapas aparece na home mas não no
// formulário do CRM (ou o contrário): ou não dá para editar, ou o PATCH
// gravado nunca chega à tela.
assert(
  "todo tipo de SECTION_TYPES tem campos em SECTION_FIELDS",
  sourceTypes.every((type) => (sourceFields[type] ?? []).length > 0),
  `sem campos: ${sourceTypes
    .filter((type) => !(sourceFields[type] ?? []).length)
    .join(", ")}`
)

assert(
  "SECTION_FIELDS não declara tipo fora de SECTION_TYPES",
  Object.keys(sourceFields).every((type) => sourceTypes.includes(type)),
  `sobrando: ${Object.keys(sourceFields)
    .filter((type) => !sourceTypes.includes(type))
    .join(", ")}`
)

console.log("\nDEFAULTS_HOME_SECTIONS (seed ⇔ fallback do storefront)")

const defaults = loadExport(DEFAULTS, "DEFAULT_HOME_SECTIONS")
const covered = new Set(defaults.map((section) => section.type))

assert(
  "cobre todos os tipos de seção",
  sourceTypes.every((type) => covered.has(type)),
  `faltando: ${sourceTypes.filter((type) => !covered.has(type)).join(", ")}`
)

assert(
  "positions são únicas",
  new Set(defaults.map((section) => section.position)).size === defaults.length,
  `positions: ${defaults.map((section) => section.position).join(", ")}`
)

assert(
  "positions estão em ordem ascendente no arquivo",
  defaults.every(
    (section, index) =>
      index === 0 || section.position > defaults[index - 1].position
  )
)

// O formulário do admin é montado a partir de `SECTION_FIELDS` e o PATCH
// substitui o `data` inteiro pelo que ele enviou: campo obrigatório vazio no
// seed vira campo apagado no primeiro "Salvar".
assert(
  "todo campo obrigatório do contrato está preenchido",
  defaults.every((section) =>
    (sourceFields[section.type] ?? [])
      .filter((field) => field.required)
      .every((field) => {
        const value = section[field.name]

        return value !== undefined && value !== null && value !== ""
      })
  )
)

// O fallback da vitrine é derivado do seed pelo gerador (o bloco
// `nav`/`footer` de `DEFAULT_HOME_SECTIONS`). Se a derivação sair errada, a
// mesma loja mostra um cabeçalho (ou rodapé) diferente conforme a semente
// rodou — ou conforme a rede —, então vale conferir mesmo vindo do mesmo
// lado.
const headerShape = (nav) =>
  JSON.stringify({ links: nav?.links ?? [], actions: nav?.actions ?? [] })
const footerShape = (footer) =>
  JSON.stringify({
    columns: footer?.columns ?? [],
    social: footer?.social ?? [],
  })
const seedNav = defaults.find((section) => section.type === "nav")
const seedFooter = defaults.find((section) => section.type === "footer")

assert(
  "o nav do seed é o DEFAULT_HEADER do storefront",
  headerShape(seedNav) === headerShape(fallbackHeader),
  `seed: ${headerShape(seedNav)}\n` +
    `       artefato: ${headerShape(fallbackHeader)}`
)

assert(
  "o footer do seed é o DEFAULT_FOOTER do storefront",
  footerShape(seedFooter) === footerShape(fallbackFooter),
  `seed: ${footerShape(seedFooter)}\n` +
    `       artefato: ${footerShape(fallbackFooter)}`
)

// `source` decide se a coluna sai do catálogo ou dos links digitados, e o
// `<select>` do admin (pacote separado) desenha a mesma lista. Todo `source`
// oferecido precisa de um ramo no desenho, senão a coluna aparece vazia na
// loja.
const footerColumnSource = readFileSync(FOOTER_COLUMN, "utf8")

for (const source of contractSources.filter((source) => source !== "links")) {
  assert(
    `a origem "${source}" tem ramo em footer-column/index.tsx`,
    footerColumnSource.includes(`column.source === "${source}"`),
    "acrescente o ramo em " +
      "frontend/src/modules/layout/components/footer-column/index.tsx"
  )
}

// Todo `content.<campo>` lido pelo rodapé precisa existir em
// `SECTION_FIELDS.footer`: é essa lista que monta o formulário do admin, e o
// PATCH substitui o `data` inteiro — campo que o render lê e a lista não
// declara fica sem editor na tela **e** é apagado do banco no primeiro
// "Salvar".
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
  "list:benefit": loadExport(ICONS, "BENEFIT_ICON_KEYS"),
  "list:action": loadExport(ICONS, "HEADER_ACTION_ICON_KEYS"),
}

const knownIcons = new Set(loadExport(ICONS, "AVAILABLE_ICON_KEYS"))

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

console.log("\nAPARÊNCIA POR SEÇÃO (contrato ⇔ loja)")

// As opções válidas (paleta, papéis de fonte, trilhos) existem num lugar só:
// o contrato. O `<select>` do admin as recebe prontas no `schema` da API e o
// storefront as recebe pelo artefato gerado, então não há duas listas para
// comparar — o que se confere aqui é que elas não estão vazias (o CRM ficaria
// sem cor e sem trilho para escolher) e que combinam entre si.
const contractColors = loadExport(CONTRACT, "THEME_COLOR_TOKENS")
const contractFonts = loadExport(CONTRACT, "FONT_ROLES")
const contractDark = loadExport(CONTRACT, "THEME_DARK_TOKENS")
const contractGroups = loadExport(CONTRACT, "APPEARANCE_GROUPS")

assert(
  "a paleta do tema tem as cores que o storefront pinta",
  contractColors.length > 0,
  "THEME_COLOR_TOKENS vazio: o CRM não teria cor para oferecer"
)

assert(
  "os papéis de fonte do tema incluem display e sans",
  ["display", "sans"].every((role) => contractFonts.includes(role)),
  `contrato: ${contractFonts.join(", ")}`
)

assert(
  "os trilhos de aparência têm rótulo",
  contractGroups.length > 0,
  "APPEARANCE_GROUPS vazio: o CRM desenharia os campos sem trilho"
)

// `THEME_DARK_TOKENS` não alimenta `<select>` nenhum: é a lista que o
// storefront usa para auto-legibilizar fundo escuro. Um token aqui que não
// esteja na paleta seria uma regra que nunca dispara (ou pior: um token que
// não existe, e a seção fica sem texto).
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
const contractThemeFonts = loadExport(CONTRACT, "THEME_FONTS")

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
    "O contrato é um só: backend/src/modules/content/{contract,defaults}.ts."
  )
  console.log(
    "Se a falha for o artefato do storefront, rode o gerador: " +
      "node scripts/gen-content.mjs"
  )
  console.log(
    "Já as listas do admin espelham frontend/src/lib/content/icons.ts " +
      "(chaves de ícone) e os campos de cada lista do contrato — essas são " +
      "mantidas à mão."
  )
  process.exit(1)
}

console.log("\nContrato em dia.")
