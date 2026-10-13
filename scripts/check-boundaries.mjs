// Fronteiras e camadas: painel × backend (R7), checkout × adapter (RV-014) e as
// camadas do storefront (R-A…R-E, F0). O porquê de cada regra, com o caso medido,
// e o mapa das camadas: docs/real-valor/15-arquitetura-modular.md
//
//   node scripts/check-boundaries.mjs        (Node puro: cabe no hook de commit)

import { readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  SOURCE_EXTENSIONS,
  findCycles,
  layerOf,
  loadAliases,
  normalizeCycle,
  readImports,
  resolveSpecifier,
  toRepoPath,
  walk,
} from "./lib/imports.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const PANEL = join(root, "admin")
const BACKEND = join(root, "backend")
const STOREFRONT = join(root, "frontend", "src")
const BASELINE = join(here, "baselines", "boundaries.json")

const failures = []

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`)
    failures.push(label)
  }
}

/** Os apelidos do tsconfig do painel que apontam para o backend (R2). */
function panelBackendAliases() {
  const tsconfig = readFileSync(join(PANEL, "tsconfig.json"), "utf8")

  // `"@algo/*": ["../backend/..."]` — o destino é relativo ao pacote do painel,
  // então resolve-se como qualquer caminho e compara-se com `backend/`.
  const entry = /"([^"]+)\/\*"\s*:\s*\[\s*"([^"]+)\/\*"/g

  return [...tsconfig.matchAll(entry)]
    .filter(([, , target]) => target.startsWith("."))
    .filter(
      ([, , target]) =>
        !relative(BACKEND, resolve(PANEL, target)).startsWith("..")
    )
    .map(([, alias]) => `${alias}/`)
}

const BACKEND_ALIASES = panelBackendAliases()

/** O import aponta para dentro de `backend/`? Relativo, por apelido ou por texto. */
function targetsBackend(file, specifier) {
  // Um relativo que escapa do CRM denuncia a fronteira pela forma
  // (`../../../../backend/src/modules/…`).
  if (specifier.startsWith(".")) {
    return !relative(BACKEND, resolve(dirname(file), specifier)).startsWith("..")
  }

  // O apelido vale como caminho para o backend; o que não resolve por sistema de
  // arquivos ainda é suspeito quando carrega o segmento do contrato.
  return (
    BACKEND_ALIASES.some((alias) => specifier.startsWith(alias)) ||
    specifier.includes("/modules/")
  )
}

const panelValueImports = walk(PANEL, SOURCE_EXTENSIONS).flatMap((file) =>
  readImports(readFileSync(file, "utf8"))
    .filter((entry) => entry.kind === "value" && targetsBackend(file, entry.specifier))
    .map((entry) => `${toRepoPath(root, file)}: ${entry.statement}`)
)

assert(
  "o painel do CRM não importa valor do backend (só `import type`)",
  panelValueImports.length === 0,
  panelValueImports.join("; ") +
    " — a tela recebe o dado pelo payload da API (ver POST /admin/content/order)"
)

// ---------------------------------------------------------------------------
// A fronteira do pagamento (RV-014). `modules/checkout/` pergunta ao REGISTRO
// quem responde por um `provider_id` — e não pode importá-lo: aqui nenhum import
// de adapter passa, nem por tipo. O histórico e o caso medido: doc 15.
// ---------------------------------------------------------------------------
const CHECKOUT = join(root, "frontend/src/modules/checkout")
const ADAPTER_PREFIX = "@lib/payments/adapters"
const STRIPE_PACKAGES = ["@stripe/react-stripe-js", "@stripe/stripe-js"]

const checkoutLeaks = walk(CHECKOUT, SOURCE_EXTENSIONS).flatMap((file) =>
  readImports(readFileSync(file, "utf8"))
    .filter(
      (entry) =>
        entry.specifier.includes(ADAPTER_PREFIX) ||
        STRIPE_PACKAGES.some((pkg) => entry.specifier.startsWith(pkg))
    )
    .map((entry) => `${toRepoPath(root, file)}: ${entry.statement}`)
)

assert(
  "o checkout não importa adapter nem SDK de pagamento (só o registry)",
  checkoutLeaks.length === 0,
  checkoutLeaks.join("; ") +
    " — quem responde por um `provider_id` é `resolvePayment()` (@lib/payments); " +
    "a UI de um meio fica dentro do adapter dele"
)


// ---------------------------------------------------------------------------
// As camadas do storefront (F0) — R-A, R-B, R-C, R-D e R-E. O mapa das camadas,
// o porquê de cada regra com o caso medido que a motivou e as exceções vivas
// (com o marco que as apaga): docs/real-valor/15-arquitetura-modular.md
// ---------------------------------------------------------------------------
const SRCFILES = walk(STOREFRONT, SOURCE_EXTENSIONS)
const ALIASES = loadAliases(join(root, "frontend", "tsconfig.json"))
const EXCEPTIONS = JSON.parse(readFileSync(BASELINE, "utf8")).exceptions

/** A camada de um caminho (`lib/data/cart.ts` → `lib`). */
function layer(file) {
  return layerOf(relative(STOREFRONT, file).split("\\").join("/"))
}

/** Os imports de um arquivo do storefront que apontam para dentro do `src/`. */
function internalImports(file) {
  return readImports(readFileSync(file, "utf8")).flatMap((entry) => {
    const target = resolveSpecifier(file, entry.specifier, ALIASES)

    return target ? [{ specifier: entry.specifier, target }] : []
  })
}

const RULES = {
  "R-A": "a camada `lib` não importa `modules` (o tipo caminha com o dono)",
  "R-B": "`lib` e `modules` não importam `app` (a direção é app → modules → lib)",
  "R-C": "fora de `lib/data`, `lib` não importa `lib/data`",
  "R-D": "o checkout só conhece o pagamento pela fachada `@lib/payments`",
  "R-E": "o grafo de imports de valor do storefront não tem ciclo",
}

const violations = { "R-A": [], "R-B": [], "R-C": [], "R-D": [], "R-E": [] }
const isData = (path) => path.startsWith("frontend/src/lib/data/")

for (const file of SRCFILES) {
  const from = toRepoPath(root, file)
  const inCheckout = from.startsWith("frontend/src/modules/checkout/")

  for (const entry of internalImports(file)) {
    const to = toRepoPath(root, entry.target)
    const record = { file: from, specifier: entry.specifier }

    if (layer(file) === "lib" && layer(entry.target) === "modules") {
      violations["R-A"].push(record)
    }

    if (["lib", "modules"].includes(layer(file)) && layer(entry.target) === "app") {
      violations["R-B"].push(record)
    }

    if (layer(file) === "lib" && !isData(from) && isData(to)) {
      violations["R-C"].push(record)
    }

    if (inCheckout && entry.specifier.startsWith("@lib/payments/")) {
      violations["R-D"].push(record)
    }
  }
}

for (const cycle of findCycles(SRCFILES, ALIASES)) {
  violations["R-E"].push({ cycle: normalizeCycle(cycle.map((file) => toRepoPath(root, file))) })
}

const keyOf = (rule, entry) =>
  rule === "R-E"
    ? `${rule}|${entry.cycle.join(" → ")}`
    : `${rule}|${entry.file}|${entry.specifier}`

const listed = new Set(EXCEPTIONS.map((entry) => keyOf(entry.rule, entry)))
const detailOf = (entry) =>
  entry.cycle ? entry.cycle.join(" → ") : `${entry.file}: ${entry.specifier}`

for (const [rule, label] of Object.entries(RULES)) {
  const unlisted = violations[rule].filter((entry) => !listed.has(keyOf(rule, entry)))

  assert(
    `${rule} — ${label}`,
    unlisted.length === 0,
    `${unlisted.map(detailOf).join("; ")} — ver docs/real-valor/15-arquitetura-modular.md`
  )
}

const dead = EXCEPTIONS.filter(
  (entry) =>
    !violations[entry.rule].some((live) => keyOf(entry.rule, live) === keyOf(entry.rule, entry))
)

assert(
  "nenhuma exceção de camada está morta (a lista só encolhe)",
  dead.length === 0,
  `${dead.map((entry) => `${entry.rule} ${detailOf(entry)} (${entry.diesIn})`).join("; ")} ` +
    "— remova do baseline: a violação não existe mais"
)

if (failures.length) {
  console.log(`\n${failures.length} verificação(ões) falharam.`)
  console.log(
    "A fronteira é essa: `admin/` (navegador) chama a API, quem decide número, " +
      "ordem e validação é `backend/`, e no storefront a direção é " +
      "`app → modules → lib → contrato` (doc 15)."
  )
  process.exit(1)
}

console.log("\nFronteira e camadas em dia.")
