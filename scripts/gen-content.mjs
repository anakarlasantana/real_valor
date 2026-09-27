/**
 * Gerador do contrato de conteúdo do storefront.
 * -----------------------------------------------------------------
 * O contrato existe num só lugar — `backend/src/modules/content/` —, mas
 * backend e frontend são pacotes npm separados, com `node_modules`
 * próprios: o storefront não consegue importar o arquivo do backend.
 *
 * Este script copia as duas partes que a vitrine usa em runtime para
 * `frontend/src/lib/content/contract.generated.ts`:
 *
 *   1. o bloco compartilhado de `contract.ts` (o que está entre os
 *      marcadores "BLOCO COMPARTILHADO"): tipos das seções, listas fechadas
 *      (tipos, paleta, papéis de fonte, trilhos) e as fontes de coluna do
 *      rodapé;
 *   2. o conteúdo padrão de `defaults.ts` — o fallback da vitrine quando a
 *      API de conteúdo falha.
 *
 * O artefato é versionado de propósito: a revisão de um contrato novo
 * mostra exatamente o que o storefront passa a receber. O `--check` roda no
 * `make check` e no hook de commit, para o arquivo não envelhecer em
 * silêncio.
 *
 * Rode:
 *   node scripts/gen-content.mjs          # regrava o artefato
 *   node scripts/gen-content.mjs --check  # exit 1 se estiver desatualizado
 *
 * Como a guarda de contrato, não usa framework de teste: roda no Node 24,
 * que carrega TypeScript nativamente.
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const CONTRACT = join(root, "backend/src/modules/content/contract.ts")
const DEFAULTS = join(root, "backend/src/modules/content/defaults.ts")
const ARTIFACT = join(root, "frontend/src/lib/content/contract.generated.ts")

/** Marcadores que delimitam o que o storefront recebe (ver `contract.ts`). */
const BEGIN_MARKER = "INÍCIO DO BLOCO COMPARTILHADO"
const END_MARKER = "FIM DO BLOCO COMPARTILHADO"
/** A linha de régua (`// =====…`) que envolve cada marcador. */
const RULER = /^\/\/ ={5,}$/

/**
 * Carrega um módulo TS e devolve o valor de um export.
 *
 * O `import` acontece num processo Node à parte — o type-stripping nativo
 * apaga os tipos e o valor volta serializado por stdout. `defaults.ts` só
 * importa o contrato como tipo, então o import é apagado junto e o ciclo de
 * resolução do módulo do Medusa não é tocado.
 */
function loadExport(file, exportName) {
  const dir = mkdtempSync(join(tmpdir(), "rv-gen-"))
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

  if (result.status !== 0) {
    throw new Error(
      `Falha ao importar ${exportName} de ${file}:\n` +
        `${result.stderr || result.stdout}`
    )
  }

  return JSON.parse(result.stdout)
}

/**
 * Fatia o bloco compartilhado do contrato: o que fica entre a régua que
 * fecha o marcador de início e a que abre o marcador de fim.
 */
function sharedBlock(source) {
  const lines = source.split("\n")
  const begin = lines.findIndex((line) => line.includes(BEGIN_MARKER))
  const end = lines.findIndex((line) => line.includes(END_MARKER))

  if (begin < 0 || end <= begin) {
    throw new Error(
      `Marcadores "${BEGIN_MARKER}"/"${END_MARKER}" ausentes em ${CONTRACT}.`
    )
  }

  const isRuler = (line) => RULER.test(line.trim())
  const open = lines.findIndex((line, index) => index > begin && isRuler(line))
  const close = lines.findLastIndex(
    (line, index) => index < end && isRuler(line)
  )

  if (open < 0 || close <= open) {
    throw new Error(`Régua ("// =====") ausente em volta dos marcadores.`)
  }

  return lines.slice(open + 1, close).join("\n").trim()
}

/**
 * Serializa o conteúdo padrão como literal TS com vírgula final e
 * indentação de 2 espaços — o formato do resto do repositório. O
 * `JSON.stringify` cru mudaria a linha inteira a cada edição e o diff de uma
 * seção nova ficaria ilegível.
 */
function toTsLiteral(value, indent = 0) {
  const pad = "  ".repeat(indent)
  const inner = "  ".repeat(indent + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    const items = value.map((item) => `${inner}${toTsLiteral(item, indent + 1)}`)

    return `[\n${items.join(",\n")},\n${pad}]`
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${inner}${JSON.stringify(key)}: ${toTsLiteral(item, indent + 1)}`
    )

    return `{\n${entries.join(",\n")},\n${pad}}`
  }

  return JSON.stringify(value)
}

const HEADER = `/**
 * Real Valor — Contrato de conteúdo do storefront.
 * -----------------------------------------------------------------
 * ARQUIVO GERADO — NÃO EDITE À MÃO.
 *
 * Copiado de \`backend/src/modules/content/contract.ts\` (bloco compartilhado)
 * e \`defaults.ts\` (conteúdo padrão) por \`node scripts/gen-content.mjs\`.
 * Contrato novo é: editar o backend, rodar o gerador, commitar o diff. O
 * \`make check\` e o hook de commit reprovam este arquivo fora de sincronia.
 *
 * Aqui só está o que o storefront lê em runtime — tipos das seções, listas
 * fechadas do tema (tipos, paleta, papéis de fonte, trilhos) e o conteúdo
 * padrão. O que é só do backend/CRM (\`SECTION_FIELDS\`, paleta de prévia,
 * validação) mora em \`contract.ts\`, abaixo do fim do bloco compartilhado.
 */`

const DEFAULTS_HEADER = `/* ---------------------------------------------------------------------------
 * CONTEÚDO PADRÃO
 *
 * Cópia exata de \`DEFAULT_HOME_SECTIONS\` em \`defaults.ts\` — mesmos ids, na
 * mesma ordem. A vitrine o usa como fallback quando a API de conteúdo falha,
 * para uma indisponibilidade do CMS não derrubar a home.
 * ------------------------------------------------------------------------- */`

/** Monta o artefato a partir do contrato e do conteúdo padrão. */
function build() {
  const contract = readFileSync(CONTRACT, "utf8")
  const defaults = loadExport(DEFAULTS, "DEFAULT_HOME_SECTIONS")

  return `${HEADER}

${sharedBlock(contract)}

${DEFAULTS_HEADER}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = ${toTsLiteral(defaults)}

/** A primeira seção de um tipo no conteúdo padrão (o cromo \`nav\`/\`footer\`). */
function defaultSection<T extends HomeSection["type"]>(
  type: T
): Extract<HomeSection, { type: T }> {
  const found = DEFAULT_HOME_SECTIONS.find((section) => section.type === type)

  if (!found) {
    throw new Error(\`Conteúdo padrão sem bloco "\${type}".\`)
  }

  return found as Extract<HomeSection, { type: T }>
}

/** Cabeçalho padrão (bloco \`nav\`) — o layout o usa em todas as rotas. */
export const DEFAULT_HEADER = defaultSection("nav")

/** Rodapé padrão (bloco \`footer\`) — idem. */
export const DEFAULT_FOOTER = defaultSection("footer")
`
}

const generated = build()

if (process.argv.includes("--check")) {
  const current = existsSync(ARTIFACT) ? readFileSync(ARTIFACT, "utf8") : ""

  if (current === generated) {
    console.log("Contrato gerado em dia.")
    process.exit(0)
  }

  console.error(
    "O contrato gerado está desatualizado (ou ausente):\n" +
      `  ${ARTIFACT}\n` +
      "Rode: node scripts/gen-content.mjs"
  )
  process.exit(1)
}

writeFileSync(ARTIFACT, generated)
console.log(
  `Gerado frontend/src/lib/content/contract.generated.ts ` +
    `(${generated.split("\n").length - 1} linhas).`
)
