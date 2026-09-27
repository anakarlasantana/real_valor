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
 * O schema em um lugar so (`modules/content/schema.ts`): e de la que a rota
 * monta o payload e de la que o `seed-schema` tira a linha do banco. As
 * chaves sao conferidas aqui, e nao na rota, porque a montagem saiu dela.
 */
const CONTENT_SCHEMA = join(root, "backend/src/modules/content/schema.ts")
const CONTENT_SERVICE = join(root, "backend/src/modules/content/service.ts")
const CONTENT_SCHEMA_MODEL = join(
  root,
  "backend/src/modules/content/models/content-schema.ts"
)
const CONTENT_MIGRATIONS = join(
  root,
  "backend/src/modules/content/migrations"
)
const SEED_SCHEMA_SCRIPT = join(root, "backend/src/scripts/seed-schema.ts")
const FLAGS_SCRIPT = join(root, "backend/src/scripts/flags.ts")
const STORE_CONTENT_ROUTE = join(root, "backend/src/api/store/content/route.ts")
const STOREFRONT_CONTENT_DATA = join(root, "frontend/src/lib/data/content.ts")
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
 * Componentes `.tsx` (o registro social, o editor do admin) são lidos como
 * texto: importá-los no Node esbarraria no JSX, que o type-stripping nativo
 * não transforma. Todo o resto que a guarda compara é carregado por
 * `loadExport`, do próprio módulo — inclusive o sub-formulário dos itens, que
 * é dado do contrato.
 */
function readBlock(source, name) {
  const match = new RegExp(`const ${name}[\\s\\S]*?\\n\\}`).exec(source)

  return match ? match[0] : ""
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
const pageSource = readFileSync(ADMIN_PAGE, "utf8")

// O sub-formulário de cada item de lista é dado do contrato, como os campos
// de seção: o admin recebe `schema.itemFields` pronto e desenha o que vier
// (`itemFields[kind]`), sem tabela própria. Um espelho digitado de volta
// divergiria em silêncio — era o que a versão antiga desta guarda comparava
// texto com texto —, então os nomes antigos viram proibição explícita.
// Uma regra, uma asserção. Eram cinco, uma por nome espelhado, e as cinco diziam
// a mesma coisa: **o painel não declara dado do contrato** — ele recebe pelo
// `schema` da API. Desde a G2 ele também não declara *tipo* (importa com
// `import type`), o que é a segunda asserção logo abaixo.
const MIRRORS = [
  "ITEM_FIELDS",
  "ICON_KEYS_BY_KIND",
  "ICON_LABELS",
  "FOOTER_COLUMN_SOURCES",
  "TYPE_LABELS",
]

const mirrorHouses = MIRRORS.flatMap((name) => {
  const pattern = new RegExp(`const ${name}\\b`)
  return [
    pattern.test(adminSource) ? `field-input.tsx (${name})` : null,
    pattern.test(pageSource) ? `page.tsx (${name})` : null,
  ].filter(Boolean)
})

assert(
  "o painel não declara dado do contrato: tudo vem do `schema`",
  mirrorHouses.length === 0,
  `declarado em: ${mirrorHouses.join(", ")}`
)

// E a forma dos tipos também não volta. O que é proibido é **declaração de
// forma** (`type X = {` ou `type X = | "a"`), não o *alias* (`type Schema =
// ContentSchemaPayload`) — que é o desejado: o nome local aponta para o
// contrato em vez de copiar o corpo. O `=` depois do nome é obrigatório, senão a
// checagem casaria com o próprio `import type { … }` do painel.
const PANEL_TYPE_SHAPES = [
  "FieldKind",
  "FieldSpec",
  "ItemFieldSpec",
  "ItemFields",
  "Schema",
]

const panelTypeShapes = PANEL_TYPE_SHAPES.filter((name) =>
  [adminSource, pageSource].some((source) =>
    new RegExp(
      `^\\s*(export )?type ${name} = (\\{|\\n\\s*\\||\\|)`,
      "m"
    ).test(source)
  )
)

assert(
  "o painel não declara a forma dos tipos do contrato (importa com `import type`)",
  panelTypeShapes.length === 0,
  "declarado no painel: " +
    panelTypeShapes.join(", ") +
    " — use `import type` de modules/content/contract"
)

// E o outro lado do mesmo defeito: um `schema` que ninguém lê é campo que
// some da tela. Os dois arquivos precisam consumir o que chega.
assert(
  'o editor lê os campos de item do schema ("itemFields")',
  adminSource.includes("itemFields") && pageSource.includes("itemFields"),
  "leia `schema.itemFields` em page.tsx e passe em field-input.tsx"
)

assert(
  'a listagem lê os rótulos de tipo do schema ("typeLabels")',
  pageSource.includes("typeLabels"),
  "leia `schema.typeLabels` em backend/src/admin/routes/content/page.tsx"
)

const contractItemFields = loadExport(CONTRACT, "ITEM_FIELDS")
const itemKinds = Object.keys(contractItemFields)
const editorFieldNames = (kind) =>
  (contractItemFields[kind] ?? []).map((field) => field.name)

assert(
  "ITEM_FIELDS do contrato tem os editores de item",
  itemKinds.length > 0,
  "o editor do admin ficaria sem sub-formulário nenhum"
)

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
    itemKinds.includes(kind),
    'acrescente o tipo em ITEM_FIELDS (backend/src/modules/content/contract.ts) ' +
      'ou trate-o como "list:text"'
  )
}

// O inverso: `kind` que ninguém alcança — nenhuma seção o usa e nenhum item o
// abre como sub-lista — é editor morto, que nenhuma tela desenha.
const nestedKinds = itemKinds.flatMap((kind) =>
  (contractItemFields[kind] ?? [])
    .map((field) => field.kind)
    .filter(
      (nested) => typeof nested === "string" && nested.startsWith("list:")
    )
)

for (const kind of itemKinds) {
  assert(
    `o editor de "${kind}" é alcançável a partir de algum campo`,
    listKinds.includes(kind) || nestedKinds.includes(kind),
    "nenhuma seção usa o kind e nenhum item o abre como sub-lista"
  )
}

// O outro lado do mesmo problema: um `kind` que não é lista e que o
// `FieldInput` não trata cai no ramo de texto — um campo de escolha vira
// caixa de digitação livre, e o lojista digita o que o `validateData` vai
// reprovar. `"text"` é o ramo padrão de propósito, então ele fica de fora.
// A exaustividade por `kind` **não é asserção: é o compilador**.
//
// O `field-input.tsx` declara `UnhandledKind = Exclude<FieldKind, HandledKind>`
// e `UNHANDLED_KINDS`, cujo tipo só aceita `true`. Um `kind` novo no contrato
// que o editor não desenha vira erro de `tsc` — verificado: injetar
// `| "date"` no contrato dá
// `TS2322: Type 'true' is not assignable to type '"date"'`.
//
// O que sobra aqui é UMA asserção, e não é sobre `kind`: é checar que a
// declaração continua lá, porque apagá-la numa refatoração devolveria a
// cobertura ao silêncio — sem erro em lugar nenhum.
assert(
  "o editor declara a exaustividade por `kind` (UNHANDLED_KINDS, o `tsc` exige)",
  /type UnhandledKind = Exclude<FieldKind, HandledKind>/.test(adminSource) &&
    /UNHANDLED_KINDS/.test(adminSource),
  "em backend/src/admin/routes/content/field-input.tsx: mantenha a declaração " +
    "que faz o `tsc` reprovar `kind` sem ramo"
)

// O ícone é escolha dentro de uma lista fechada, e a lista é declarada no
// contrato (`options` do campo `icon`) porque o registro que desenha o ícone
// vive no storefront, outro pacote. O que se confere aqui é que os dois lados
// oferecem **as mesmas** chaves: chave nova num lado só ofereceria no admin um
// ícone que a loja não desenha — ou o contrário, um ícone que ninguém escolhe.
const iconOptions = (kind) => {
  const field = (contractItemFields[kind] ?? []).find((f) => f.name === "icon")

  return field?.options ?? null
}

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

const iconKeysByKind = {
  "list:benefit": loadExport(ICONS, "BENEFIT_ICON_KEYS"),
  "list:action": loadExport(ICONS, "HEADER_ACTION_ICON_KEYS"),
  "list:social": socialKeys,
}

const knownIcons = new Set(loadExport(ICONS, "AVAILABLE_ICON_KEYS"))

for (const [kind, expected] of Object.entries(iconKeysByKind)) {
  const found = iconOptions(kind)

  assert(
    `"${kind}" oferece as mesmas chaves de ícone`,
    found !== null && JSON.stringify(found) === JSON.stringify(expected),
    `contrato: ${found?.join(", ") ?? "não lido"}\n` +
      `       storefront: ${expected?.join(", ") ?? "não lido"}`
  )
}

assert(
  "toda chave de ícone oferecida tem um ícone no registro do storefront",
  Array.isArray(iconKeysByKind["list:benefit"]) &&
    Array.isArray(iconKeysByKind["list:action"]) &&
    [...iconKeysByKind["list:benefit"], ...iconKeysByKind["list:action"]].every(
      (key) => knownIcons.has(key)
    ),
  `sem ícone: ${
    [...(iconKeysByKind["list:benefit"] ?? []), ...(iconKeysByKind["list:action"] ?? [])]
      .filter((key) => !knownIcons.has(key))
      .join(", ") || "nenhuma"
  }`
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

// O item de cada lista também existe como tipo no contrato — é o que o
// storefront lê. Comparar os nomes, na ordem, é o que garante que editor e
// loja falam do mesmo item: campo num lado só deixa o lojista sem como
// preencher o que a loja renderiza, ou o contrário. `list:image` fica fora
// porque não tem tipo nomeado (o `images` do Instagram é inline).
const contractSource = readFileSync(CONTRACT, "utf8")

const ITEM_TYPES = {
  "list:benefit": "BenefitItem",
  "list:highlight": "CollectionHighlight",
  "list:link": "HeaderLink",
  "list:action": "HeaderAction",
  "list:column": "FooterColumn",
  "list:social": "FooterSocial",
}

for (const [kind, typeName] of Object.entries(ITEM_TYPES)) {
  const typeFields = readTypeFields(contractSource, typeName)
  const editorFields = editorFieldNames(kind)

  assert(
    `o editor de "${kind}" tem os mesmos campos de "${typeName}"`,
    typeFields !== null &&
      JSON.stringify(editorFields) === JSON.stringify(typeFields),
    `editor: ${editorFields.join(", ") || "não lido"}\n` +
      `       ${typeName}: ${typeFields?.join(", ") ?? "não lido"}`
  )
}

// A origem de uma coluna é escolha dentro de uma lista fechada
// (`FOOTER_COLUMN_SOURCES`); o editor precisa oferecer exatamente essas
// opções, e cada uma precisa de rótulo — sem ele o lojista escolheria entre
// "categories" e "collections" no `<select>`.
const columnSourceField = (contractItemFields["list:column"] ?? []).find(
  (field) => field.name === "source"
)

assert(
  '"list:column" oferece as mesmas origens de coluna do contrato',
  columnSourceField?.options !== undefined &&
    JSON.stringify(columnSourceField.options) ===
      JSON.stringify(contractSources),
  `editor: ${columnSourceField?.options?.join(", ") ?? "não lido"}\n` +
    `       contrato: ${contractSources.join(", ")}`
)

const columnSourceLabels = loadExport(CONTRACT, "FOOTER_COLUMN_SOURCE_LABELS")
const missingSourceLabels = contractSources.filter(
  (source) => !columnSourceLabels[source]
)

assert(
  "toda origem de coluna tem rótulo",
  missingSourceLabels.length === 0,
  `sem rótulo: ${missingSourceLabels.join(", ") || "nenhuma"}`
)

// Mesma ideia para os ícones: a tradução é dado do contrato (o admin a recebe
// em `optionLabels`), então oferecer uma chave sem rótulo — ou manter um
// rótulo órfão, de chave que não existe mais — é divergência de um lado só.
// Os dois sentidos são conferidos.
const offeredIcons = [
  ...new Set(itemKinds.map((kind) => iconOptions(kind) ?? []).flat()),
]
const iconLabels = loadExport(CONTRACT, "ICON_LABELS")

assert(
  "toda chave de ícone oferecida tem rótulo no contrato",
  offeredIcons.every((key) => Boolean(iconLabels[key])),
  `sem rótulo: ${
    offeredIcons.filter((key) => !iconLabels[key]).join(", ") || "nenhuma"
  }`
)

assert(
  "não há rótulo de ícone órfão no contrato",
  Object.keys(iconLabels).every((key) => offeredIcons.includes(key)),
  `órfão: ${
    Object.keys(iconLabels)
      .filter((key) => !offeredIcons.includes(key))
      .join(", ") || "nenhum"
  }`
)

// O mesmo para a listagem: o rótulo de cada tipo de seção viaja no `schema`
// (`typeLabels`), então um tipo sem rótulo aparece como jargão na tela e um
// rótulo órfão é linha de tabela que ninguém lê.
const typeLabels = loadExport(CONTRACT, "SECTION_TYPE_LABELS")
const unlabeledTypes = sourceTypes.filter((type) => !typeLabels[type])
const orphanTypeLabels = Object.keys(typeLabels).filter(
  (type) => !sourceTypes.includes(type)
)

assert(
  "todo tipo de seção tem rótulo na listagem",
  unlabeledTypes.length === 0,
  `sem rótulo: ${unlabeledTypes.join(", ") || "nenhum"}`
)

assert(
  "não há rótulo de tipo órfão no contrato",
  orphanTypeLabels.length === 0,
  `órfão: ${orphanTypeLabels.join(", ") || "nenhum"}`
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
// contrato: o trilho em que vale. **Não é mais asserção** — a página declara
// `const BACKGROUND_RAIL: AppearanceGroup = "Fundo"`, com o tipo importado do
// contrato, então um trilho renomeado ou removido quebra o `tsc` em vez de
// deixar o aviso apontando para o nada em silêncio (que era o defeito: o aviso
// simplesmente nunca aparecia).

// O painel não importa o contrato, então o hex e a família chegam pelo
// `schema` da API. Se o `schema` deixar de mandá-los, a bolinha sai sem cor e
// a lista de fontes cai no fallback do navegador — que é o erro que a prévia
// não tem como esconder, porque ainda "funciona". Vale o mesmo para os
// rótulos de tipo e para os campos de item: sem eles a listagem mostra
// jargão e o editor de lista fica sem sub-formulário.
const adminRoute = readFileSync(ADMIN_CONTENT_ROUTE, "utf8")
const contentSchema = readFileSync(CONTENT_SCHEMA, "utf8")
const schemaKeys = [
  "types: SECTION_TYPES",
  "typeLabels: SECTION_TYPE_LABELS",
  "fields: SECTION_FIELDS",
  "itemFields: ITEM_FIELDS",
  "palette: THEME_COLOR_HEXES",
  "fonts: THEME_FONTS",
  "darkTokens: THEME_DARK_TOKENS",
]
const offSchema = schemaKeys.filter((key) => !contentSchema.includes(key))

assert(
  "o schema do CRM é montado num lugar só, com tipos, campos, rótulos, " +
    "campos de item, paleta, fontes e cores escuras",
  offSchema.length === 0,
  `faltando no schema: ${offSchema.join(", ") || "nenhum"}`
)

// E a rota tem que **consumir** esse lugar, senão o schema volta a ser montado
// dentro dela — que é como as duas pontas (rota e seed) acabariam divergindo
// sem ninguém perceber.
// A rota **lê** o schema do serviço…
assert(
  "a rota do admin lê o schema do registro (`service.getSchema()`)",
  adminRoute.includes("service.getSchema()") &&
    adminRoute.includes("schema: stored.schema") &&
    adminRoute.includes("schemaVersion: stored.version") &&
    adminRoute.includes("schemaSource: stored.source"),
  "em backend/src/api/admin/content/route.ts: sirva `stored` (schema, versão e origem)"
)

// …e **não monta** o schema. A montagem é o bootstrap e mora em `schema.ts`;
// se a rota voltar a montar, o registro deixa de valer e o `contract.ts` volta
// a ser o único lugar que decide o formulário — que é o defeito que este
// trabalho tirou do caminho.
//
// O teste é o **import** e a montagem inline (as chaves do schema), e não a
// menção a `buildSchema()`: citar a função num comentário é legítimo e útil,
// e uma guarda que reprova comentário obriga o próximo a apagar a explicação.
assert(
  "a rota do admin não monta o schema (isso é do `schema.ts`/bootstrap)",
  !/import\s*\{[^}]*\bbuildSchema\b/.test(adminRoute) &&
    !schemaKeys.some((key) => adminRoute.includes(key)),
  "em backend/src/api/admin/content/route.ts: use `service.getSchema()` — " +
    "a montagem do schema é do `schema.ts`"
)

console.log("\nSCHEMA COMO DADO (content_schema, o registro do crm)")

const contentService = readFileSync(CONTENT_SERVICE, "utf8")
const contentSchemaModel = readFileSync(CONTENT_SCHEMA_MODEL, "utf8")
const seedSchemaScript = readFileSync(SEED_SCHEMA_SCRIPT, "utf8")
const flagsScript = readFileSync(FLAGS_SCRIPT, "utf8")
const storeContentRoute = readFileSync(STORE_CONTENT_ROUTE, "utf8")
const storefrontContentData = readFileSync(STOREFRONT_CONTENT_DATA, "utf8")

// A migration cria a **tabela** e nada mais. Um `insert` com o JSON do schema
// dentro da migration faria o historico depender do codigo do dia em que rodou:
// um banco novo em 2027 nasceria com o schema de 2027, e o de 2026 ficaria com
// o de 2026 — divergencia entre ambientes, que e o oposto do objetivo. O
// conteudo da linha e dado derivado de codigo, e quem escreve e o seed-schema.
const migrationFiles = readdirSync(CONTENT_MIGRATIONS)
  .filter((file) => file.startsWith("Migration") && file.endsWith(".ts"))
const schemaMigration = migrationFiles.filter((file) => {
  const text = readFileSync(join(CONTENT_MIGRATIONS, file), "utf8")
  return /create table[^"]*"?content_schema"?/i.test(text)
})
const insertingMigrations = schemaMigration.filter((file) => {
  const text = readFileSync(join(CONTENT_MIGRATIONS, file), "utf8")
  return /insert\s+into/i.test(text)
})

assert(
  "existe migration criando a tabela `content_schema`",
  schemaMigration.length > 0,
  `gerada por \`medusa db:generate content\` — nenhuma migration cria a tabela`
)

assert(
  "a migration do schema nao insere linha (so DDL): o dado e do seed-schema",
  schemaMigration.length > 0 && insertingMigrations.length === 0,
  `com insert: ${insertingMigrations.join(", ")}`
)

assert(
  "o model tem chave, versão e data (uma linha só)",
  contentSchemaModel.includes('model.define("content_schema"') &&
    contentSchemaModel.includes("model.text().primaryKey()") &&
    contentSchemaModel.includes("version: model.number()") &&
    contentSchemaModel.includes("data: model.json()"),
  "em backend/src/modules/content/models/content-schema.ts"
)

// O serviço é quem decide a fonte: registro primeiro, contrato por baixo, e
// declara qual dos dois respondeu (`source`) para o payload não mentir.
assert(
  "o serviço lê o registro e declara a origem (`source`) com fallback no contrato",
  contentService.includes("async getSchema") &&
    contentService.includes("listContentSchemas") &&
    contentService.includes('source: "db"') &&
    contentService.includes('source: "contract"') &&
    contentService.includes("async saveSchema"),
  "em backend/src/modules/content/service.ts"
)

// A versão mora no contrato e é carimbada na gravação: se derivasse do banco,
// ninguém veria a divergência entre o schema que gravou os dados e o do código.
// Lidos como texto, e não por `loadExport`: `schema.ts` importa **valores** do
// contrato, e o import de `./contract` (sem extensão) não resolve no type-
// stripping do Node — que é a mesma razão de o `loadExport` funcionar no
// contrato e no `defaults.ts` (lá o import do contrato é só de tipo e some).
const schemaVersion = Number(
  /export const SCHEMA_VERSION = (\d+)/.exec(contentSchema)?.[1]
)
const schemaKey = /export const SCHEMA_KEY = "([^"]+)"/.exec(contentSchema)?.[1]

assert(
  "a versão do schema é um inteiro declarado no contrato (SCHEMA_VERSION)",
  Number.isInteger(schemaVersion) && schemaVersion > 0,
  `veio: ${JSON.stringify(schemaVersion)}`
)

assert(
  "o seed-schema grava a linha com a versão do contrato e a chave fixa",
  seedSchemaScript.includes("service.saveSchema") &&
    seedSchemaScript.includes("version: SCHEMA_VERSION") &&
    contentService.includes("SCHEMA_KEY") &&
    typeof schemaKey === "string" &&
    schemaKey.length > 0,
  `SCHEMA_KEY veio: ${JSON.stringify(schemaKey)}`
)

// O `--check` é o que a CI chama: sem ele, "mudei o contrato e esqueci o
// registro" só apareceria quando alguém rodasse o seed. E a comparação é por
// `isDeepStrictEqual`, não por `JSON.stringify` — `data` é `jsonb` e não
// preserva ordem de chave, então stringify acusaria diff numa base recém-gravada.
assert(
  "o seed-schema tem `--check` que não grava e compara sem stringify",
  seedSchemaScript.includes("--check") &&
    seedSchemaScript.includes("isDeepStrictEqual") &&
    !seedSchemaScript.includes("JSON.stringify(stored"),
  "em backend/src/scripts/seed-schema.ts"
)

// As flags do `medusa exec` chegam em `process.argv`, não em `ExecArgs.args`
// (nesta versão do CLI). Os dois scripts de seed passam pelo helper, senão o
// `--force` documentado volta a ser silenciosamente ignorado.
const seedContentScript = readFileSync(
  join(root, "backend/src/scripts/seed-content.ts"),
  "utf8"
)
assert(
  "os scripts de seed leem as flags de process.argv (via `scriptFlags`)",
  flagsScript.includes("process.argv") &&
    seedSchemaScript.includes("scriptFlags") &&
    seedContentScript.includes("scriptFlags") &&
    !/\(args \?\? \[\]\)\.includes\(/.test(seedSchemaScript) &&
    !/\(args \?\? \[\]\)\.includes\(/.test(seedContentScript),
  "em backend/src/scripts/flags.ts"
)

// A loja recebe a versão e descarta o que não conhece: o render da home é
// exaustivo (`assertNever` lança), então um tipo novo gravado no registro sem
// deploy viraria 500 sem esse filtro.
assert(
  "a loja recebe `schemaVersion` e filtra tipo desconhecido",
  storeContentRoute.includes("schemaVersion: version") &&
    storefrontContentData.includes("schemaVersion") &&
    storefrontContentData.includes("supportedSections") &&
    storefrontContentData.includes("isSectionType"),
  "em backend/src/api/store/content/route.ts e frontend/src/lib/data/content.ts"
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
    "Já as chaves de ícone e os campos de cada lista vivem no contrato " +
      "(frontend/src/lib/content/icons.ts é quem desenha o ícone, e é o " +
      "único espelho que a guarda compara texto com texto)."
  )
  process.exit(1)
}

console.log("\nContrato em dia.")
