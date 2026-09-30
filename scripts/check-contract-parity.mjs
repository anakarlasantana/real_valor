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
 *   - o editor do admin (`admin/src/admin/routes/content/field-input.tsx`)
 *     saber desenhar todo tipo de lista do contrato, com as mesmas chaves de
 *     ícone que `frontend/src/lib/content/icons.ts` oferece. O painel importa o
 *     *tipo* do contrato desde a R2 (`import type` pelo alias `@conteudo/*` do
 *     `admin/tsconfig.json`), e import de VALOR do backend é a fronteira que
 *     `scripts/check-boundaries.mjs` vigia; o que continua mantido à mão é o
 *     **dado** — as chaves de ícone, o sub-formulário dos itens, os rótulos de
 *     tipo —, então é aqui que a divergência acontece em silêncio (um campo sem
 *     editor, um ícone que não desenha);
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
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { dirname } from "node:path"

import { callExport, loadExport } from "./lib/load-export.mjs"

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
  "admin/src/admin/routes/content/field-input.tsx"
)
/**
 * A página do editor e o CSS dos controles de aparência. A página é quem
 * decide onde o trilho é desenhado (percorrendo a ordem do contrato) e quem
 * avisa a regra do fundo escuro; o CSS é quem declara o `@font-face` das
 * fontes da prévia.
 *
 * Desde a R7 os dois moram no pacote do CRM (`admin/`), irmão de `backend/`
 * — a guarda segue o código.
 */
const ADMIN_PAGE = join(root, "admin/src/admin/routes/content/page.tsx")

/**
 * Todo o código do painel: `.ts`/`.tsx` sob `admin/src`, menos os testes.
 *
 * As duas asserções de espelho (`MIRRORS` e `PANEL_TYPE_SHAPES`) dizem "**o
 * painel** não declara dado nem forma do contrato", e até a R2 elas liam dois
 * arquivos (o editor e a página). Medido na R2: uma cópia da forma de um tipo num
 * TERCEIRO arquivo do painel passava pelas duas — a asserção era mais estreita
 * que a frase que ela imprime. Agora a varredura é o pacote inteiro, que é o que
 * a frase diz.
 *
 * `__tests__` fica de fora: um teste monta fixture com o formato de um payload, e
 * um fixture chamado como uma tabela do contrato seria falso positivo. O que se
 * proíbe é o painel **em execução** ter uma segunda fonte de dado ou de tipo.
 */
function panelSources(dir = join(root, "admin/src")) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        return entry.name === "__tests__" ? [] : panelSources(path)
      }

      return /\.tsx?$/.test(entry.name)
        ? [{ path: relative(root, path), source: readFileSync(path, "utf8") }]
        : []
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

const APPEARANCE_CSS = join(
  root,
  "admin/src/admin/routes/content/appearance.css"
)
const ADMIN_CONTENT_ROUTE = join(root, "backend/src/api/admin/content/route.ts")
/**
 * A porta que publica a ordem da vitrine (R6.5) e a regra que ela aplica. A
 * guarda confere que a numeração sai do módulo e que a tela não faz o serviço
 * do servidor.
 */
const ADMIN_ORDER_ROUTE = join(
  root,
  "backend/src/api/admin/content/order/route.ts"
)
const ORDER_MODULE = join(root, "backend/src/modules/content/order.ts")
/**
 * O schema em um lugar so (`modules/content/schema.ts`): e de la que a rota
 * monta o payload e de la que o `seed-schema` tira a linha do banco. As
 * chaves sao conferidas aqui, e nao na rota, porque a montagem saiu dela.
 */
const CONTENT_SCHEMA = join(root, "backend/src/modules/content/schema.ts")
const CONTENT_SERVICE = join(root, "backend/src/modules/content/service.ts")
const CONTENT_CONTRACT_MODEL = join(
  root,
  "backend/src/modules/content/models/content-contract.ts"
)
/**
 * O modelo das seções (`content_section`): a tabela da vitrine. Lida aqui
 * porque a guarda confere o que **só existe em DDL** — que a coluna morta
 * `title` não volte, por exemplo.
 */
const CONTENT_SECTION_MODEL = join(
  root,
  "backend/src/modules/content/models/content-section.ts"
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
 * O filtro de tipo desconhecido da loja, que saiu de `content.ts` para
 * ficar testável sem o SDK da Medusa (ver `supported-sections.spec.ts`).
 */
const STOREFRONT_SUPPORTED_SECTIONS = join(
  root,
  "frontend/src/lib/data/supported-sections.ts"
)
/**
 * O trilho de lançamentos: o render da seção e a decisão do tamanho.
 *
 * O render é o outro lado do `SECTION_FIELDS.launches` — campo que ele lê e o
 * contrato não declara fica sem editor no CRM (e o PATCH apaga o valor no
 * primeiro "Salvar"). A util guarda a faixa do `limit` como espelho à mão,
 * porque o artefato gerado do storefront não leva `SECTION_FIELDS` (ele é só
 * do CRM): três números que precisam bater com o contrato.
 */
const LAUNCHES_RAIL = join(
  root,
  "frontend/src/modules/home/components/launches-rail/index.tsx"
)
const LAUNCHES_UTIL = join(root, "frontend/src/lib/util/launches.ts")
/**
 * As fontes da prévia: `THEME_FONTS` diz a família e a pilha, mas quem
 * entrega os bytes ao navegador do painel é o `@font-face` do
 * `appearance.css` apontando para a cópia local. Conferir a família sem
 * conferir o arquivo deixaria passar a pior falha possível — a prévia
 * desenhada numa fonte que ninguém está vendo.
 */
const ADMIN_FONTS = join(root, "admin/src/admin/routes/content/fonts")
const STOREFRONT_FONTS = join(root, "frontend/src/app/fonts")
/**
 * O seed do tema: um diretório por tema, escrito de `themes.ts` pelo
 * `gen-content.mjs`. A guarda confere que o **conjunto** em disco é o do
 * contrato — um diretório órfão aqui é um tema que a loja resolve em runtime
 * e que o contrato (e o banco, na R4) não conhece.
 */
const THEMES_DIR = join(root, "frontend/themes")
/** As estações e o padrão: a lista de temas do contrato. */
const THEMES = join(root, "backend/src/modules/content/themes.ts")
/** Os tokens da paleta, gerados do contrato para o `brand.css`. */
const TOKENS_CSS = join(root, "frontend/src/styles/tokens.generated.css")
/** `themeToCSSVariables`: monta os `--rv-*` das listas do contrato. */
const THEME_TS = join(root, "frontend/src/lib/theme.ts")
/** O leitor do tema no storefront: o payload, e não os arquivos (R5). */
const THEME_DATA = join(root, "frontend/src/lib/data/theme.ts")
const FRONTEND_LAYOUT = join(root, "frontend/src/app/layout.tsx")
const FRONTEND_DOCKERFILE = join(root, "frontend/Dockerfile")
const FOOTER_COLUMN = join(
  root,
  "frontend/src/modules/layout/components/footer-column/index.tsx"
)
const FOOTER_TEMPLATE = join(
  root,
  "frontend/src/modules/layout/templates/footer/index.tsx"
)
/**
 * A vitrine de destaque — a seção que passou a ter **referência** na R1.
 *
 * Os chips dela deixaram de ser rótulos digitados (`"Blazers"`, que não existe
 * no catálogo) e viraram link para categoria; o que se confere aqui é que o
 * render e o formulário falam do mesmo campo, e que esse campo continua sendo
 * uma referência.
 */
const FEATURED_PRODUCTS = join(
  root,
  "frontend/src/modules/home/components/featured-products/index.tsx"
)
/** O link dos chips: a tabela e o lado do catálogo que a leitura pressupõe. */
const CATEGORY_LINK = join(
  root,
  "backend/src/links/content-section-category.ts"
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
 * O carregador de módulo TS vive em `scripts/lib/load-export.mjs` desde a R4:
 * o gerador precisou dele pelo mesmo motivo (comparar **dado**, não texto) e o
 * hook de resolução do `./contract` sem extensão não podia existir em duas
 * cópias.
 *
 * A ressalva continua valendo: ele só serve para arquivo sem dependência de
 * runtime. `icons.ts` é o contra-exemplo — importa **valor** de
 * `@medusajs/icons` (é o registro que desenha o ícone), e resolver esse import
 * pede o `node_modules` do storefront, que o job `guarda de contrato` da CI não
 * instala de propósito. Era essa a única causa de aquele job nunca fechar num
 * clone limpo. Ver a seção dos ícones, que o lê como texto, e o comentário do
 * `readBlock`.
 */

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
 * Componentes `.tsx` (o registro social, o editor do admin) e o registro de
 * ícones da loja são lidos como texto: os `.tsx` esbarrariam no JSX, que o
 * type-stripping nativo não transforma, e o `icons.ts` puxaria
 * `@medusajs/icons` — valor, logo `node_modules`, que a guarda não tem (o job
 * de CI dela não instala nada). Todo o resto que a guarda compara é carregado
 * por `loadExport`, do próprio módulo — inclusive o sub-formulário dos itens,
 * que é dado do contrato.
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
// 1. OS ARTEFATOS GERADOS ESTÃO EM DIA
// ---------------------------------------------------------------------------
// O storefront não tem mais uma cópia digitada do contrato: ele compila
// `frontend/src/lib/content/contract.generated.ts`, gerado de
// `contract.ts` + `defaults.ts`. E desde a R3-lite o mesmo gerador escreve o
// **seed do tema** (`frontend/themes/<id>/theme.json`, de `themes.ts` +
// `THEME_COLOR_HEXES`) e os **tokens** de `frontend/src/styles/tokens.generated.css`.
// A sincronia dos seis é conferida pelo próprio gerador — que compara arquivo a
// arquivo e nomeia o que estiver velho —, no lugar das ~300 linhas de comparação
// campo a campo que existiam aqui.
const generated = spawnSync("node", [GENERATOR, "--check"], {
  encoding: "utf8",
})

assert(
  "os artefatos gerados (contrato, seed do tema e tokens) estão em dia",
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

// O formulário do admin é montado a partir de `SECTION_FIELDS` e o PATCH manda
// de volta todo campo que a lista declara. Campo obrigatório vazio no seed é o
// que o formulário enviaria vazio no primeiro "Salvar" — e, medido em
// 2026-09-29 (na R1), o `update` do módulo **mescla** o `data` em vez de
// substituí-lo: o valor antigo ficaria órfão no banco, invisível para quem edita.
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
// `SECTION_FIELDS.footer`: é essa lista que monta o formulário do admin —
// campo que o render lê e a lista não declara fica sem editor na tela, e o
// valor gravado fica órfão (o `update` **mescla** o `data`; medido em
// 2026-09-29, na R1).
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

console.log("\nTRILHO DE LANÇAMENTOS (render ⇔ contrato)")

// Mesma regra do rodapé, para a seção que o lojista ganha nova: todo
// `section.<campo>` que o trilho lê precisa ter editor em
// `SECTION_FIELDS.launches`. Campo lido e não declarado aparece na loja, não
// tem como ser editado no CRM, e o valor gravado fica órfão no `data` (o
// `update` mescla; medido em 2026-09-29, na R1).
const launchesRail = readFileSync(LAUNCHES_RAIL, "utf8")
const railReads = [
  ...new Set(
    [...launchesRail.matchAll(/\bsection\.([A-Za-z_$][\w$]*)/g)].map(
      (match) => match[1]
    )
  ),
]
const launchesSpecFields = (sourceFields.launches ?? []).map(
  (field) => field.name
)

assert(
  "todo campo que o trilho de lançamentos lê tem editor em SECTION_FIELDS.launches",
  railReads.length > 0 &&
    railReads.every((name) => launchesSpecFields.includes(name)),
  `render lê: ${railReads.join(", ") || "nenhum"}\n` +
    `       contrato: ${launchesSpecFields.join(", ") || "NENHUM"}`
)

// E a faixa do `limit`: o mínimo, o máximo e o tamanho padrão existem em dois
// lugares — o campo do contrato (que o CRM desenha e a API valida) e a util do
// storefront (que é a última defesa, porque o que está gravado pode ser
// anterior à faixa). Faixa divergente aqui é o tipo de erro que só aparece em
// produção: o CRM deixa digitar 6 e a loja desenha 2.
const launchesUtil = readFileSync(LAUNCHES_UTIL, "utf8")
const utilConstant = (name) => {
  const match = new RegExp(`export const ${name} = (\\d+)`).exec(launchesUtil)

  return match ? Number(match[1]) : null
}
const limitField = (sourceFields.launches ?? []).find(
  (field) => field.name === "limit"
)
const seedLaunches = defaults.find((section) => section.type === "launches")

assert(
  "a faixa do `limit` do trilho é a do campo declarado no contrato",
  limitField?.min !== undefined &&
    limitField?.max !== undefined &&
    utilConstant("LAUNCHES_LIMIT_MIN") === limitField.min &&
    utilConstant("LAUNCHES_LIMIT_MAX") === limitField.max,
  `util: ${utilConstant("LAUNCHES_LIMIT_MIN")}–${utilConstant(
    "LAUNCHES_LIMIT_MAX"
  )}\n` +
    `       campo: ${limitField?.min}–${limitField?.max}`
)

assert(
  "o tamanho padrão do trilho é o `limit` do conteúdo padrão",
  seedLaunches?.limit !== undefined &&
    utilConstant("LAUNCHES_LIMIT_FALLBACK") === seedLaunches.limit,
  `util: ${utilConstant("LAUNCHES_LIMIT_FALLBACK")}\n` +
    `       padrão: ${seedLaunches?.limit}`
)

console.log("\nVITRINE DE DESTAQUE (render ⇔ contrato)")

// Mesma regra do rodapé e do trilho, agora para a seção que ganhou referência:
// todo `section.<campo>` que a vitrine lê precisa ter editor em
// `SECTION_FIELDS.featured`. Sem ele o campo aparece na loja e não dá para
// editar — e foi por não haver campo nenhum que o chip era texto livre.
const featuredRail = readFileSync(FEATURED_PRODUCTS, "utf8")
const featuredReads = [
  ...new Set(
    [...featuredRail.matchAll(/\bsection\.([A-Za-z_$][\w$]*)/g)].map(
      (match) => match[1]
    )
  ),
]
const featuredSpecFields = (sourceFields.featured ?? []).map(
  (field) => field.name
)

assert(
  "todo campo que a vitrine de destaque lê tem editor em SECTION_FIELDS.featured",
  featuredReads.length > 0 &&
    featuredReads.every((name) => featuredSpecFields.includes(name)),
  `render lê: ${featuredReads.join(", ") || "nenhum"}\n` +
    `       contrato: ${featuredSpecFields.join(", ") || "NENHUM"}`
)

// E o outro lado da mesma fase: os chips são **referência** (`list:category`),
// não texto. `filters` de volta a `list:text` traria de volta o chip de rótulo
// digitado — e o `q=Blazers` que devolvia zero peças sem erro nenhum. O que a
// loja filtra é `categoryId` (`category_id` na Store API), e é isso que o
// campo declara.
const filtersField = (sourceFields.featured ?? []).find(
  (field) => field.name === "filters"
)

assert(
  "os chips da vitrine são referência (`list:category`), não texto",
  filtersField?.kind === "list:category",
  `filters é "${filtersField?.kind ?? "não declarado"}"`
)

// A referência mora num **link**, e o default do link é o nome composto pelo
// Medusa (`product_category_content_section`): a tabela é `content_section_category`
// porque o nome foi declarado. Nome de tabela errado não quebra nada visível —
// ele cria uma segunda tabela e a leitura devolve vazio (vitrine sem chips), que
// é a falha silenciosa que esta asserção existe para não repetir.
const categoryLink = readFileSync(CATEGORY_LINK, "utf8")

assert(
  "o link dos chips declara a tabela `content_section_category`",
  categoryLink.includes('table: "content_section_category"') &&
    categoryLink.includes("ProductModule.linkable.productCategory"),
  "ver backend/src/links/content-section-category.ts: `table` e o lado da categoria"
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

const PANEL_SOURCES = panelSources()

const mirrorHouses = MIRRORS.flatMap((name) => {
  const pattern = new RegExp(`const ${name}\\b`)

  return PANEL_SOURCES.filter(({ source }) => pattern.test(source)).map(
    ({ path }) => `${path} (${name})`
  )
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
//
// Por que isto continua sendo TEXTO e não o `tsc` — medido na R2, já com o painel
// importando tipo por `@conteudo/*`: no MESMO arquivo que importa `FieldKind`,
// redeclarar a forma dá **TS2440** (o compilador pega, mas é o caso que o texto já
// pegava); num arquivo que não importa o nome, `type FieldKind = { x: string }`
// compila **verde** — tipo estrutural não enxerga cópia, e é a cópia que se
// proíbe. O compilador cobre o caso que já estava coberto e é cego para o que
// importa. O caminho certo aqui é a asserção, com a varredura do painel inteiro.
const PANEL_TYPE_SHAPES = [
  "FieldKind",
  "FieldSpec",
  "ItemFieldSpec",
  "ItemFields",
  "Schema",
]

const panelTypeShapes = PANEL_TYPE_SHAPES.flatMap((name) => {
  const pattern = new RegExp(
    `^\\s*(export )?type ${name} = (\\{|\\n\\s*\\||\\|)`,
    "m"
  )

  return PANEL_SOURCES.filter(({ source }) => pattern.test(source)).map(
    ({ path }) => `${path} (${name})`
  )
})

assert(
  "o painel não declara a forma dos tipos do contrato (importa com `import type`)",
  panelTypeShapes.length === 0,
  "declarado no painel: " +
    panelTypeShapes.join(", ") +
    " — use `import type` de `@conteudo/contract` (o alias de admin/tsconfig.json)"
)

// A fronteira do painel — nenhum `import` de VALOR vindo do backend — mudou de
// casa junto com o código: a R7 a levou para `scripts/check-boundaries.mjs`, que
// varre o pacote `admin/` inteiro. Aqui, onde ela nasceu, a varredura era só o
// par `page.tsx`/`field-input.tsx` (e as duas fontes já vieram por parâmetro de
// outra verificação); lá ela é a razão de existir do arquivo.

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
  "leia `schema.typeLabels` em admin/src/admin/routes/content/page.tsx"
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
  "em admin/src/admin/routes/content/field-input.tsx: mantenha a declaração " +
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

// O registro de ícones da loja entra pela mesma regra, e não pelo `loadExport`:
// `icons.ts` importa **valor** de `@medusajs/icons` (é ele quem desenha), então
// importá-lo exige o `node_modules` do storefront. Medido num clone limpo
// (`git worktree add --detach`, sem `node_modules` e sem `.medusa`): `make
// check` morria aqui com `ERR_MODULE_NOT_FOUND`, e era a única causa do job
// `guarda de contrato` nunca passar. Ler o texto é o que o registro social logo
// acima já fazia — e o fato de o arquivo ser lido como texto não afrouxa nada:
// `AVAILABLE_ICON_KEYS` é `Object.keys(ICONS)` por definição, as duas listas
// são literais no arquivo, e uma leitura que falhe (mapa renomeado, formatação
// fora do `readBlock`) cai nos `assert` abaixo, que exigem `Array.isArray` e a
// chave presente no registro. Não há caminho que passe sem ler.
const iconsSource = readFileSync(ICONS, "utf8")
const iconsMapKeys = readObjectKeys(readBlock(iconsSource, "ICONS"))

const iconKeysByKind = {
  "list:benefit": readStringList(iconsSource, "BENEFIT_ICON_KEYS"),
  "list:action": readStringList(iconsSource, "HEADER_ACTION_ICON_KEYS"),
  "list:social": socialKeys,
}

const knownIcons = new Set(iconsMapKeys)

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

// A paleta e as famílias **não se conferem mais** contra o `theme.json`: desde
// a R3-lite o arquivo é gerado de `THEME_COLOR_HEXES`/`THEME_FONTS`, e é o
// `--check` do gerador (no `make check`) que garante que ele está em dia. A
// comparação hex a hex que existia aqui só podia dar verde.
//
// O que sobra para conferir é o que a geração **não** cobre:
//
//   1. o seed em disco é exatamente o conjunto de temas do contrato;
//   2. cada token da paleta sai no CSS gerado (um laço vazio geraria um
//      arquivo em dia e nenhum token);
//   3. o `brand.css` não voltou a declarar a paleta — nem trocou o fallback de
//      fonte que o contrato declara;
//   4. o `theme.ts` monta as variáveis das listas do contrato, sem as digitar.
const themeDefault = loadExport(THEMES, "THEME_DEFAULT")
const themeSeasons = loadExport(THEMES, "THEME_SEASONS")
const contractThemeIds = [
  themeDefault.id,
  ...themeSeasons.map((theme) => theme.id),
]
const seedThemeIds = existsSync(THEMES_DIR)
  ? readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : []
const missingSeeds = contractThemeIds.filter((id) => !seedThemeIds.includes(id))
const orphanSeeds = seedThemeIds.filter((id) => !contractThemeIds.includes(id))

assert(
  "o seed em `themes/` é exatamente o conjunto de temas do contrato",
  contractThemeIds.length > 1 &&
    missingSeeds.length === 0 &&
    orphanSeeds.length === 0,
  `faltando: ${missingSeeds.join(", ") || "nenhum"} | ` +
    `órfão: ${orphanSeeds.join(", ") || "nenhum"}`
)

// ---------------------------------------------------------------------------
// SUPERFÍCIE DE TEMA (R4) — o tema como conteúdo do CRM
// ---------------------------------------------------------------------------
//
// O tema deixou de ser só um seed em disco: é conteúdo, gravado na mesma
// `content_section` das seções, sobre a coluna `surface` que já existia. O que
// esta seção confere é o que **atravessa pacotes** — o contrato contra o payload
// que a API serve, e o seed contra as linhas que o banco vai receber. As regras
// puras (cobertura de `THEME_FIELDS`, o achatamento campo a campo, `defaultsFor`)
// têm teste próprio no backend, onde o runner tem `node_modules`.

const themeType = loadExport(CONTRACT, "THEME_TYPE")
const themeTypeLabel = loadExport(CONTRACT, "THEME_TYPE_LABEL")
const themeSurface = loadExport(CONTRACT, "THEME_SURFACE")
const contractSurfaces = loadExport(CONTRACT, "CONTENT_SURFACES")
const contentTypes = loadExport(CONTRACT, "CONTENT_TYPES")
const themeFields = loadExport(CONTRACT, "THEME_FIELDS")
const themeFiles = loadExport(THEMES, "THEME_FILES")
const themeRows = loadExport(THEMES, "THEME_SECTIONS")

const surfaceProblems = contractSurfaces.flatMap((surface) => {
  const blanks = ["id", "label", "enabledLabel", "blockLabel", "hint"].filter(
    (key) => typeof surface[key] !== "string" || !surface[key]
  )
  const types = Array.isArray(surface.types) && surface.types.length

  return [
    ...blanks.map((key) => `${surface.id ?? "?"}: ${key} vazio`),
    ...(types ? [] : [`${surface.id ?? "?"}: sem tipos criáveis`]),
    ...("titleField" in surface
      ? []
      : [`${surface.id ?? "?"}: sem \`titleField\` declarado`]),
  ]
})

assert(
  "cada superfície se descreve (rótulo, título, aviso e tipos criáveis)",
  contractSurfaces.length > 1 && surfaceProblems.length === 0,
  surfaceProblems.join(" | ") || "nenhum"
)

// A união do que as superfícies criam **é** a lista de tipos que a API aceita
// gravar (`CONTENT_TYPES`), e as duas são lidas por caminhos diferentes: o
// diálogo "Nova seção" lê a superfície, o `validateData` lê a lista. Uma
// superfície que declare um tipo fora dela vira um botão que responde 400; um
// tipo na lista que nenhuma superfície oferece vira dado que ninguém cria pela
// tela.
const surfaceTypes = [...new Set(contractSurfaces.flatMap((s) => s.types))]
const unionOff = [
  ...contentTypes.filter((type) => !surfaceTypes.includes(type)),
  ...surfaceTypes.filter((type) => !contentTypes.includes(type)),
]

assert(
  "a união das superfícies é `CONTENT_TYPES` (o que a API aceita gravar)",
  contentTypes.includes(themeType) && unionOff.length === 0,
  `fora da união: ${unionOff.join(", ") || "nenhum"}`
)

// A superfície de tema é a única que dá nome ao bloco pelo rótulo do dono
// ("Natal") — a home se chama pelo tipo, porque o `type` é o identificador do
// render —, e a única que cria estações. A home não pode oferecer `theme`: um
// bloco de tema na vitrine seria um tipo que nenhum render da home desenha.
const themeSurfaceSpec = contractSurfaces.find((s) => s.id === themeSurface)
const homeSurfaceSpec = contractSurfaces.find((s) => s.id === "home")

assert(
  "a superfície de tema se declara (título pelo rótulo, e só ela cria estações)",
  themeSurfaceSpec?.titleField === "label" &&
    themeSurfaceSpec.types.length === 1 &&
    themeSurfaceSpec.types[0] === themeType &&
    Boolean(themeTypeLabel) &&
    homeSurfaceSpec?.titleField === null &&
    !homeSurfaceSpec.types.includes(themeType),
  `superfície: ${JSON.stringify(themeSurfaceSpec?.types) ?? "ausente"}`
)

const tokensCss = existsSync(TOKENS_CSS) ? readFileSync(TOKENS_CSS, "utf8") : ""

// A linha que o seed grava fala a **mesma língua** dos campos que o CRM edita:
// todo campo de `data` da estação existe em `THEME_FIELDS`. É a checagem que
// pega a cor nova no contrato sem campo no editor — a linha sairia com uma
// chave que o `validateData` recusaria num PATCH, e que o CRM não desenharia
// para corrigir.
//
// O **mapeamento** campo a campo (`rose` → `colorRose`, com o valor de cada um)
// vive no teste do backend (`themes.unit.spec.ts`), com as mesmas funções que o
// seed usa. Aqui fica a comparação que não precisa de runner: a chave existe no
// editor, os valores da linha são os do `theme.json` e a contagem bate — e é a
// contagem que pega a ausência silenciosa.
const themeFieldNames = new Set(themeFields.map((field) => field.name))
const rowByTheme = new Map(themeRows.map((row) => [row.id, row]))
const seedRowProblems = []

for (const theme of themeFiles) {
  const row = rowByTheme.get(theme.id)

  if (!row) {
    seedRowProblems.push(`${theme.id}: sem linha de seed`)
    continue
  }

  if (row.type !== themeType) {
    seedRowProblems.push(`${theme.id}: type fora do contrato`)
  }

  const colors = Object.values(theme.colors ?? {})
  const fonts = Object.values(theme.fonts ?? {})
  const dates = theme.dateRange
    ? [theme.dateRange.start, theme.dateRange.end]
    : []
  const unknown = Object.keys(row).filter(
    (key) =>
      !["id", "type", "enabled", "position"].includes(key) &&
      !themeFieldNames.has(key)
  )

  if (unknown.length) {
    seedRowProblems.push(`${theme.id}: campo sem editor (${unknown.join(", ")})`)
  }

  const missing = [...colors, ...fonts, ...dates].filter(
    (value) => !Object.values(row).includes(value)
  )

  if (missing.length) {
    seedRowProblems.push(
      `${theme.id}: valor do seed fora da linha (${missing.join(", ")})`
    )
  }

  const expected = 1 + dates.length + colors.length + fonts.length
  const present = Object.keys(row).length - 4

  if (present !== expected) {
    seedRowProblems.push(
      `${theme.id}: ${present} campo(s) na linha, ${expected} no tema`
    )
  }
}

assert(
  "a linha do seed é o tema (`THEME_SECTIONS` ⇔ `theme.json`), campo a campo",
  themeRows.length > 1 && seedRowProblems.length === 0,
  seedRowProblems.join(" | ") || "nenhum"
)

assert(
  "as estações do seed têm os ids do contrato e posições crescentes",
  themeRows.map((row) => row.id).join(",") ===
    themeFiles.map((theme) => theme.id).join(",") &&
    themeRows.every(
      (row, index) => row.position === (index + 1) * 10 && row.enabled === true
    ),
  themeRows.map((row) => `${row.id}@${row.position}`).join(", ")
)
const missingTokens = contractColors.filter(
  (token) => !tokensCss.includes(`--rv-${token}:`)
)

assert(
  "cada token da paleta do contrato é declarado no CSS gerado",
  contractColors.length > 0 && missingTokens.length === 0,
  `ausente: ${missingTokens.join(", ") || "nenhum"}`
)

// O `brand.css` é o valor com que a página pinta **antes** do tema inline
// (`themeToCSSVariables` reescreve os mesmos `--rv-*` por requisição). Se ele
// voltar a declarar a paleta, o valor digitado volta a competir com o gerado
// e o contrato deixa de mandar na cor da loja.
const redeclared = contractColors.filter((token) =>
  brandCss.includes(`--rv-${token}:`)
)

assert(
  "o brand.css não declara a paleta (ela é gerada)",
  redeclared.length === 0,
  `declarado à mão: ${redeclared.join(", ") || "nenhuma"}`
)

// A tipografia do `brand.css` é a única que fica: o valor dela é o
// `var(--font-*)` que o `localFont` do Next publica no layout (a família real
// é hasheada pelo Next), e isso é ligação do storefront, não dado de tema. O
// **fallback** é dado de tema, e tem de ser o do contrato — a loja o escreve
// em `themeToCSSVariables`, e duas pilhas diferentes fariam a fonte da página
// mudar conforme a estação resolve ou não.
const offFontFallbacks = contractFonts.filter((role) => {
  const line = new RegExp(
    `--rv-font-${role}:\\s*var\\(--font-[a-z-]+\\),\\s*([^;]+);`
  ).exec(brandCss)

  return line?.[1].trim() !== contractThemeFonts[role]?.fallback
})

assert(
  "o fallback de cada `--rv-font-*` do brand.css é o que o contrato declara",
  offFontFallbacks.length === 0,
  `divergente: ${offFontFallbacks.join(", ") || "nenhum"}`
)

const themeTs = readFileSync(THEME_TS, "utf8")
const handwrittenTokens = contractColors.filter((token) =>
  themeTs.includes(`"--rv-${token}"`)
)

assert(
  "o theme.ts monta as variáveis das listas do contrato, sem as digitar",
  handwrittenTokens.length === 0 && themeTs.includes("THEME_COLOR_TOKENS"),
  `digitado: ${handwrittenTokens.join(", ") || "nenhum"}`
)

// ---------------------------------------------------------------------------
// O tema vem do PAYLOAD (R5) — e o `themes/` sai da imagem
// ---------------------------------------------------------------------------
//
// A promessa do F3, em duas partes, e as duas são checáveis: "some o `fs` em
// request-time" (não há leitura de disco no caminho da loja) e "some o `COPY`
// do Dockerfile" (a pasta não vai mais para a imagem). A leitura do tema passou
// a ser `lib/data/theme.ts`, como a do conteúdo — com a mesma tag de cache, que
// é o que faz uma edição no CRM aparecer na loja pelo mesmo aviso.

const themeData = readFileSync(THEME_DATA, "utf8")
const layout = readFileSync(FRONTEND_LAYOUT, "utf8")
const dockerfile = readFileSync(FRONTEND_DOCKERFILE, "utf8")

const diskReads = ["readdirSync", "readFileSync", "from \"fs\"", '"fs"'].filter(
  (signal) => themeTs.includes(signal)
)

assert(
  "a loja não lê o tema do disco: o `fs` saiu do caminho do request",
  diskReads.length === 0,
  `sinal(is) de disco em frontend/src/lib/theme.ts: ${diskReads.join(", ") || "nenhum"}`
)

// E o outro lado da mesma promessa: se não lê do disco, tem de **pedir** ao
// payload — a superfície certa (`theme`, não a `home`) e com a tag de cache do
// conteúdo, que é o que faz uma edição no CRM invalidadar o tema junto.
const themeRequest = [
  themeData.includes('surface: "theme"') ? "" : 'a query `surface: "theme"`',
  themeData.includes("CONTENT_CACHE_TAG") ? "" : "a tag `content`",
].filter(Boolean)

assert(
  "a loja pede a superfície de tema ao payload, com a tag do conteúdo",
  themeRequest.length === 0,
  `em frontend/src/lib/data/theme.ts, faltando ${themeRequest.join(" e ")}`
)

// O `default` ainda é importado de propósito — é o fallback embutido, que entra
// no bundle do build —, mas isso é um `import`, não uma leitura de pasta.
assert(
  "o tema padrão continua embutido como fallback (um `import`, não o disco)",
  themeTs.includes("../../themes/default/theme.json"),
  "em frontend/src/lib/theme.ts: o fallback é o JSON gerado do contrato"
)

assert(
  "o layout espera o tema, lido do módulo de dados",
  layout.includes("await getActiveTheme()") &&
    layout.includes("@lib/data/theme") &&
    !layout.includes("getActiveTheme, themeToCSSVariables"),
  "em frontend/src/app/layout.tsx: `await getActiveTheme()` de `@lib/data/theme`"
)

assert(
  "o `themes/` não é mais copiado para a imagem do storefront",
  !dockerfile.includes("COPY --from=builder --chown=nextjs:nextjs /app/themes"),
  "em frontend/Dockerfile: a pasta ficou só no contexto do build (o JSON é importado)"
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

/**
 * O payload do CRM é **o contrato**, chave por chave.
 *
 * A comparação é de dado: `buildSchema()` é chamado e o que ele devolve é
 * comparado com as constantes do contrato (o `scripts/lib/load-export.mjs`
 * passou a saber chamar função na R4 — JSON não serializa uma). Antes eram oito
 * strings procuradas no texto do arquivo, que provavam que alguém tinha escrito
 * aquele nome em algum lugar, e não que a chave **servida** fosse aquela lista.
 */
const builtSchema = callExport(CONTENT_SCHEMA, "buildSchema")
const expectedSchema = {
  types: contentTypes,
  typeLabels: {
    ...loadExport(CONTRACT, "SECTION_TYPE_LABELS"),
    [themeType]: themeTypeLabel,
  },
  // Os campos de todo tipo **editável**: as seções e o bloco de tema.
  fields: { ...loadExport(CONTRACT, "SECTION_FIELDS"), [themeType]: themeFields },
  itemFields: loadExport(CONTRACT, "ITEM_FIELDS"),
  palette: contractHexes,
  fonts: contractThemeFonts,
  darkTokens: contractDark,
  singletonTypes: loadExport(CONTRACT, "SINGLETON_SECTION_TYPES"),
  surfaces: contractSurfaces,
}
const offSchema = Object.entries(expectedSchema)
  .filter(([key, value]) => !isDeepStrictEqual(builtSchema[key], value))
  .map(([key]) => key)

assert(
  "o payload do CRM é o contrato: tipos, campos (com o tema), rótulos, itens, " +
    "paleta, fontes, cores escuras, tipos únicos e superfícies",
  offSchema.length === 0,
  `divergente em: ${offSchema.join(", ") || "nenhum"}`
)

// A mesma tela edita as duas superfícies. O seletor sai do **schema**
// (`CONTENT_SURFACES` viaja no payload), e não de uma constante no React: uma
// superfície nova no contrato aparece na tela sem edição no painel — a mesma
// promessa que a bolinha de cor e o sub-formulário dos itens já fazem.
const adminPage = readFileSync(ADMIN_PAGE, "utf8")

assert(
  "o CRM monta o seletor de superfície e o diálogo a partir do schema",
  adminPage.includes("schema?.surfaces") &&
    adminPage.includes("currentSurface") &&
    adminPage.includes("?surface="),
  "em admin/src/admin/routes/content/page.tsx: leia `schema.surfaces`"
)

// E a rota amarra a superfície ao tipo nas **duas** portas que gravam: o POST
// (o bloco nasce na superfície dele, mesmo que o corpo diga outra) e o PATCH
// (nenhuma edição move um bloco para a superfície de tema). A regra é uma
// função só, em `validation.ts`, com teste próprio.
assert(
  "a rota do admin amarra a superfície ao tipo no POST e no PATCH",
  (adminRoute.match(/resolveSurface\(/g) ?? []).length >= 2,
  "em backend/src/api/admin/content/route.ts: use `resolveSurface` nas duas portas"
)

// E a rota tem que **consumir** esse lugar, senão o schema volta a ser montado
// dentro dela — que é como as duas pontas (rota e seed) acabariam divergindo
// sem ninguém perceber.
// A rota **lê** o schema do serviço…
assert(
  "a rota do admin lê o schema do registro (`service.getContract()`)",
  adminRoute.includes("service.getContract()") &&
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
// O teste é o **import** e a montagem inline (as chaves do payload), e não a
// menção a `buildSchema()`: citar a função num comentário é legítimo e útil,
// e uma guarda que reprova comentário obriga o próximo a apagar a explicação.
const mountedSchemaKeys = [
  "typeLabels:",
  "itemFields:",
  "singletonTypes:",
  "surfaces:",
]

assert(
  "a rota do admin não monta o schema (isso é do `schema.ts`/bootstrap)",
  !/import\s*\{[^}]*\bbuildSchema\b/.test(adminRoute) &&
    !mountedSchemaKeys.some((key) => adminRoute.includes(key)),
  "em backend/src/api/admin/content/route.ts: use `service.getContract()` — " +
    "a montagem do schema é do `schema.ts`"
)

console.log("\nCONTRATO COMO DADO (content_contract, o registro do crm)")

// A ordem da vitrine (R6.5). Duas coisas, e as duas são de "uma resposta só".
//
// Primeiro a faixa: o numeral que a tela desenha com a ordem **pendente** é
// previsão do que o `POST /admin/content/order` vai gravar, e a faixa chega como
// dado (`order: orderFaixa()`), tirada das constantes do módulo. Número digitado
// na rota seria uma segunda resposta para "onde a numeração começa" — e a
// divergência apareceria como numeral que não bate com o que a loja recebe.
//
// Segundo, que o painel **use** esse dado: um `order` que ninguém lê é payload
// morto, e a lista pendente voltaria a mostrar o número gravado (o defeito que
// a fase conserta).
const orderModule = readFileSync(ORDER_MODULE, "utf8")
const orderRoute = readFileSync(ADMIN_ORDER_ROUTE, "utf8")

assert(
  "a faixa da ordem no payload sai das constantes do módulo (`orderFaixa`)",
  adminRoute.includes("order: orderFaixa()") &&
    orderModule.includes("export function orderFaixa") &&
    orderModule.includes("first: FIRST_VITRINE_POSITION") &&
    orderModule.includes("step: POSITION_STEP"),
  "em backend/src/api/admin/content/route.ts: `order: orderFaixa()` — a " +
    "faixa é de modules/content/order.ts"
)

assert(
  "a tela numera a ordem pendente com a faixa do payload (não com a regra)",
  pageSource.includes("order.first + place * order.step") &&
    pageSource.includes('"/admin/content/order"'),
  "em admin/src/admin/routes/content/page.tsx: numeral da ordem pendente " +
    "sai de `order` (payload) e a publicação é o POST /admin/content/order"
)

// E a porta é uma só: a renumeração é do módulo (`applyOrder`), a loja é avisada
// **uma vez** e não há `PATCH` por seção. Era esse laço que a fase tirou do
// navegador — N requisições, N gravações e N avisos, com a ordem podendo ficar
// pela metade.
assert(
  "a porta da ordem renumera pelo módulo e avisa a loja uma vez",
  orderRoute.includes("applyOrder") &&
    orderRoute.includes("readOrderIds") &&
    (orderRoute.match(/notifyStorefront\(/g) ?? []).length === 1 &&
    !/method: "PATCH"/.test(orderRoute),
  "em backend/src/api/admin/content/order/route.ts"
)

const contentService = readFileSync(CONTENT_SERVICE, "utf8")
const contentContractModel = readFileSync(CONTENT_CONTRACT_MODEL, "utf8")
const contentSectionModel = readFileSync(CONTENT_SECTION_MODEL, "utf8")
const seedSchemaScript = readFileSync(SEED_SCHEMA_SCRIPT, "utf8")
const flagsScript = readFileSync(FLAGS_SCRIPT, "utf8")
const storeContentRoute = readFileSync(STORE_CONTENT_ROUTE, "utf8")
const storefrontContentData = readFileSync(STOREFRONT_CONTENT_DATA, "utf8")
const supportedSections = readFileSync(STOREFRONT_SUPPORTED_SECTIONS, "utf8")

// A migration cria a **tabela** e nada mais. Um `insert` com o JSON do schema
// dentro da migration faria o historico depender do codigo do dia em que rodou:
// um banco novo em 2027 nasceria com o schema de 2027, e o de 2026 ficaria com
// o de 2026 — divergencia entre ambientes, que e o oposto do objetivo. O
// conteudo da linha e dado derivado de codigo, e quem escreve e o seed-schema.
//
// As duas leituras juntas explicam o historico da tabela: `create table` a
// criou com o nome antigo (`content_schema`) e o `rename to` a trouxe para o
// nome de hoje (`content_contract`). Exigir as duas e o que impede alguem de
// "arrumar" a migration antiga em vez de escrever um rename — reescrever
// historico de migration e o que deixa dois bancos com o mesmo commit em
// estados diferentes.
const migrationFiles = readdirSync(CONTENT_MIGRATIONS)
  .filter((file) => file.startsWith("Migration") && file.endsWith(".ts"))
const migrationText = (file) =>
  readFileSync(join(CONTENT_MIGRATIONS, file), "utf8")
/**
 * O SQL de uma migration, **sem os comentários**: as asserções têm de valer
 * sobre o que roda no banco. A docstring do rename cita `create table` e
 * `drop table` justamente para explicar por que elas não são o caminho aqui, e
 * uma guarda que reprova comentário obriga o próximo a apagar a explicação (a
 * mesma razão de a rota do admin ser conferida por import, e não por menção).
 */
const migrationSql = (text) =>
  [...text.matchAll(/addSql\(`([^`]*)`\)/g)].map(([, sql]) => sql).join("\n")
/**
 * O SQL do `up()`. O `down()` desfaz a mesma coisa no sentido inverso — e
 * devolve o `title` vazio de propósito —, então conferir o arquivo inteiro
 * acusaria o rollback como se a coluna estivesse voltando.
 */
const upSql = (text) => migrationSql(text.split(/override async down/)[0])
const contractMigrations = migrationFiles.filter((file) =>
  /create table[^"]*"?content_(schema|contract)"?/i.test(
    migrationSql(migrationText(file))
  )
)
const contractRenameMigrations = migrationFiles.filter((file) =>
  /rename to "?content_contract"?/i.test(migrationSql(migrationText(file)))
)
const sectionRenameMigrations = migrationFiles.filter((file) =>
  /rename to "?content_section"?/i.test(migrationSql(migrationText(file)))
)
const insertingMigrations = migrationFiles.filter((file) =>
  /insert\s+into/i.test(migrationSql(migrationText(file)))
)

assert(
  "existe migration criando a tabela do contrato (e o rename que a nomeou de novo)",
  contractMigrations.length > 0 && contractRenameMigrations.length > 0,
  `gerada por \`medusa db:generate content\` — nenhuma migration cria a tabela; ` +
    `rename to "content_contract": ${contractRenameMigrations.join(", ") || "nenhum"}`
)

assert(
  "a migration do contrato nao insere linha (so DDL): o dado e do seed-schema",
  insertingMigrations.length === 0,
  `com insert: ${insertingMigrations.join(", ")}`
)

assert(
  "o model do contrato tem chave, versão e data (uma linha só)",
  contentContractModel.includes('model.define("content_contract"') &&
    contentContractModel.includes("model.text().primaryKey()") &&
    contentContractModel.includes("version: model.number()") &&
    contentContractModel.includes("data: model.json()"),
  "em backend/src/modules/content/models/content-contract.ts"
)

// A coluna `title` da seção **não volta**. Ela duplicava o `data.title` de
// quatro tipos, o CRM não a mostrava e a loja nunca a leu: o PATCH de "Título"
// ia para a coluna, respondia 200 e a vitrine não mudava. Como a divisão do
// corpo (`payload.ts`) hoje é por nome de coluna, uma coluna nova que também
// fosse campo do contrato voltaria a exigir desempate — e o desempate é onde o
// defeito morava. As migrations antigas continuam criando a coluna (historico);
// quem tem de estar limpo é o **model** e o **up** do rename.
assert(
  "existe migration renomeando a tabela das seções para `content_section`",
  sectionRenameMigrations.length > 0,
  `rename to "content_section": ${sectionRenameMigrations.join(", ") || "nenhum"}`
)

assert(
  "a seção não tem mais a coluna `title` (nem no model, nem no up do rename)",
  !/^ {2}title: model\./m.test(contentSectionModel) &&
    !/add column "?title"?/i.test(
      upSql(sectionRenameMigrations.map(migrationText).join("\n"))
    ),
  "em backend/src/modules/content/models/content-section.ts — título é `data.title`"
)

// O serviço é quem decide a fonte: registro primeiro, contrato por baixo, e
// declara qual dos dois respondeu (`source`) para o payload não mentir.
// A decisão ("registro ou bootstrap?") mora em `resolveSchema`, no `schema.ts` —
// é pura e testável sem container (`schema-record.unit.spec.ts`). O serviço fica
// com o I/O: ler a linha e delegar.
assert(
  "a decisão registro x bootstrap é pura (`resolveSchema`) e o serviço delega",
  contentSchema.includes("export function resolveSchema") &&
    contentSchema.includes('source: "db"') &&
    contentSchema.includes('source: "contract"') &&
    contentService.includes("async getContract") &&
    contentService.includes("listContentContracts") &&
    contentService.includes("resolveSchema(row)") &&
    contentService.includes("async saveContract"),
  "em backend/src/modules/content/{schema,service}.ts"
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
  seedSchemaScript.includes("service.saveContract") &&
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
    storefrontContentData.includes("supportedSections(") &&
    supportedSections.includes("isSectionType") &&
    supportedSections.includes("export function supportedSections"),
  "em backend/src/api/store/content/route.ts e " +
    "frontend/src/lib/data/{content,supported-sections}.ts"
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
