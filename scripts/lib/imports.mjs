// Leitura de import de fonte — a base das guardas de camada do storefront.
// Quem importa o quê, e de que camada, é o dado que R-A…R-E julgam em
// `scripts/check-boundaries.mjs`; o porquê de cada regra, o mapa das camadas e a
// política de comentário estão em `docs/real-valor/15-arquitetura-modular.md`.
// Sem dependência: Node puro, para o `make check` rodar sem `node_modules`.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

export const SOURCE_EXTENSIONS = [".ts", ".tsx"]

// Declaração `import … from "x"` no começo da linha, com o `type` capturado.
// `import("x")` e `import "x"` não são casados. Por que o regex é assim: doc 15.
const DECL = /(?:^|\n)[ \t]*import(\s+type\b)?\s*(?:(?!\bimport\b)[\s\S])*?from\s+"([^"]*)"/g

/** Todos os arquivos com as extensões dadas, recursivo e em ordem de disco. */
export function walk(dir, extensions = SOURCE_EXTENSIONS) {
  const found = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      // `node_modules`/`.next`/`dist`/`.medusa` não são fonte deste repositório.
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        found.push(...walk(path, extensions))
      }
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(path)
    }
  }

  return found
}

/** `[{ specifier, kind: "value" | "type", statement }]`, na ordem do arquivo. */
export function readImports(source) {
  return [...source.matchAll(DECL)].map((match) => ({
    specifier: match[2],
    kind: match[1] ? "type" : "value",
    statement: match[0].trim().split("\n")[0],
  }))
}

/**
 * Os apelidos de caminho do `tsconfig.json`, como `[{ prefix, dir }]` — lidos de
 * lá, não repetidos aqui: renomear um apelido não pode abrir buraco na guarda.
 */
export function loadAliases(tsconfigPath) {
  const source = readFileSync(tsconfigPath, "utf8")
  const base = resolve(dirname(tsconfigPath), /"baseUrl"\s*:\s*"([^"]*)"/.exec(source)?.[1] ?? ".")

  return [...source.matchAll(/"([^"]+)\/\*"\s*:\s*\[\s*"([^"]+)\/\*"\s*\]/g)].map(
    ([, alias, target]) => ({ prefix: `${alias}/`, dir: resolve(base, target) })
  )
}

function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false
}

// O arquivo que um specifier aponta, ou `null` se não for interno (pacote npm,
// `@rv/contrato`) ou não existir. Resolve apelido/relativo, com extensão e `index`.
export function resolveSpecifier(fromFile, specifier, aliases) {
  let target = null

  if (specifier.startsWith(".")) {
    target = resolve(dirname(fromFile), specifier)
  } else {
    const alias = aliases.find((entry) => specifier.startsWith(entry.prefix))
    if (!alias) return null

    target = resolve(alias.dir, specifier.slice(alias.prefix.length))
  }

  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    join(target, "index.ts"),
    join(target, "index.tsx"),
  ]

  return candidates.find(isFile) ?? null
}

/** A camada de um caminho DENTRO de `frontend/src` (`lib/data/cart.ts` → `lib`). */
export function layerOf(srcRelative) {
  const [first] = srcRelative.split("/")

  return ["app", "modules", "lib", "types", "styles"].includes(first) ? first : "root"
}

/**
 * Os ciclos do grafo de imports de VALOR entre os arquivos dados, cada um uma
 * vez e normalizado. `import type` fica de fora: não existe no bundle, então não
 * é ciclo de execução — o que se proíbe é o ciclo que roda.
 */
export function findCycles(files, aliases) {
  const edges = new Map()

  for (const file of files) {
    const targets = readImports(readFileSync(file, "utf8"))
      .filter((entry) => entry.kind === "value")
      .map((entry) => resolveSpecifier(file, entry.specifier, aliases))
      .filter((target) => target && target !== file)

    edges.set(file, targets)
  }

  const OPEN = 1
  const DONE = 2
  const state = new Map()
  const stack = []
  const cycles = new Map()

  const visit = (file) => {
    state.set(file, OPEN)
    stack.push(file)

    for (const next of edges.get(file) ?? []) {
      if (state.get(next) === OPEN) {
        const cycle = stack.slice(stack.indexOf(next))
        cycles.set(normalizeCycle(cycle).join(" → "), cycle)
      } else if (!state.has(next)) {
        visit(next)
      }
    }

    stack.pop()
    state.set(file, DONE)
  }

  for (const file of files) {
    if (!state.has(file)) visit(file)
  }

  return [...cycles.values()]
}

/** Gira o ciclo para que o menor caminho venha primeiro: a chave é estável. */
export function normalizeCycle(files) {
  const smallest = files.reduce((a, b) => (a < b ? a : b))
  const at = files.indexOf(smallest)

  return [...files.slice(at), ...files.slice(0, at)]
}

/** Caminhos do repositório, `posix`, para a saída e o baseline serem estáveis. */
export function toRepoPath(root, path) {
  return relative(root, path).split("\\").join("/")
}
