/**
 * Guarda da fronteira entre o CRM e o backend.
 * -----------------------------------------------------------------
 * Desde a R7 o CRM mora em `admin/`, um pacote IRMÃO de `backend/`: React 18,
 * bundle e `tsconfig` próprios, compilado pelo Vite do backend (a fonte entra
 * pelo `admin.sources` do `backend/medusa-config.ts`). A fronteira que esta
 * guarda defende é uma só:
 *
 *   o painel importa TIPO do backend (`import type`), nunca VALOR.
 *
 * Por que isso precisa de guarda: importar valor **compila**. O último caso foi a
 * numeração da ordem da vitrine (`positionFor`/`renumber`/`nextPosition`, tirados
 * na R6.5): a conta era feita dentro do navegador e a gravação saía como N
 * `PATCH`es — uma segunda resposta para "que número esta seção recebe", que volta
 * em silêncio porque nada quebra. O que a tela precisa chega pelo payload da API
 * (`order` em `GET /admin/content`, a publicação em `POST /admin/content/order`).
 *
 * A verificação nasceu dentro do `check-contract-parity.mjs` (a R6.5 a somou ali)
 * e a R7 a herdou aqui, junto com o código que mudou de casa.
 *
 * Rode com:
 *   node scripts/check-boundaries.mjs
 *
 * Não usa framework de teste de propósito, como o `check-contract-parity.mjs`.
 */

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const PANEL = join(root, "admin")
const BACKEND = join(root, "backend")

function walk(dir, extensions) {
  const found = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    // `node_modules` não existe no CRM hoje (as dependências são as do
    // backend), mas um dia pode existir: varre-lo seria lento e cheio de
    // falso positivo.
    if (entry.isDirectory() && entry.name !== "node_modules") {
      found.push(...walk(path, extensions))
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(path)
    }
  }

  return found
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
 * `(?:^|\n)[ \t]*import` ancora o começo da **declaração** (o Prettier quebra o
 * import em várias linhas, e um `import` de dentro de um comentário não tem esse
 * alinhamento); o `(?!type\b)` separa o que é permitido — `import type { … }`,
 * que não existe no bundle — do que não é; e o `(?:(?!\bimport\b)[\s\S])*?`
 * impede que o casamento atravesse a declaração seguinte (era o falso positivo
 * do `@medusajs/ui` antes de um `modules/content` mais abaixo no arquivo).
 */
const VALUE_IMPORT =
  /(?:^|\n)[ \t]*import\s+(?!type\b)(?:(?!\bimport\b)[\s\S])*?from\s+"([^"]*)"/g

/** O import aponta para dentro de `backend/`? Relativo, absoluto ou por texto. */
function targetsBackend(file, specifier) {
  if (specifier.startsWith(".")) {
    // Um relativo que escapa do CRM denuncia a fronteira pela própria forma
    // (`../../../../../backend/src/modules/…`): resolve-se o alvo e compara-se
    // com o diretório do backend.
    const fromBackend = relative(BACKEND, resolve(dirname(file), specifier))

    return !fromBackend.startsWith("..")
  }

  // O que não resolve por sistema de arquivos (apelido, nome de pacote) ainda é
  // suspeito quando carrega o segmento do contrato.
  return specifier.includes("/modules/")
}

const panelValueImports = walk(PANEL, [".ts", ".tsx"]).flatMap((file) => {
  const source = readFileSync(file, "utf8")

  return [...source.matchAll(VALUE_IMPORT)]
    .filter((match) => targetsBackend(file, match[1]))
    .map((match) => {
      const file_ = relative(root, file)
      const statement = match[0].trim().split("\n")[0]

      return `${file_}: ${statement}`
    })
})

assert(
  "o painel do CRM não importa valor do backend (só `import type`)",
  panelValueImports.length === 0,
  panelValueImports.join("; ") +
    " — a tela recebe o dado pelo payload da API (ver POST /admin/content/order)"
)

if (failures.length) {
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log(
    "A fronteira é essa: `admin/` (navegador) chama a API; quem decide número, " +
      "ordem e validação é `backend/`."
  )
  process.exit(1)
}

console.log("\nFronteira em dia.")
