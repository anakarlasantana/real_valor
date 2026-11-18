/** Rastreio requisito → critério → prova (unit, api, jornada).
 *  node scripts/gen-traceability.mjs           → regrava docs/real-valor/traceability.json
 *  node scripts/gen-traceability.mjs --check   → exit 1 se velho, sem prova ou sem hash
 *  node scripts/gen-traceability.mjs --sha ID  → imprime o sha dos critérios de uma spec
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const specsDir = join(raiz, "spec")
const destino = "docs/real-valor/traceability.json"

function frontmatter(texto) {
  const bloco = /^---\n([\s\S]*?)\n---/.exec(texto)?.[1] ?? ""
  const dados = {}

  for (const linha of bloco.split("\n")) {
    const par = /^([a-z_]+):\s*(.*)$/.exec(linha)
    if (par) dados[par[1]] = par[2].trim().replace(/^["']|["']$/g, "")
  }

  return dados
}

function criterios(texto) {
  const lista = []
  let atual = null

  for (const linha of texto.split("\n")) {
    const ca = /^- \*\*(CA-\d+)\*\*\s*[—–-]\s*(.+)$/.exec(linha)

    if (ca) {
      atual = { id: ca[1], texto: ca[2].trim(), prova: null }
      lista.push(atual)
      continue
    }

    const prova = /^\s+prova:\s*`([^`]+)`\s*$/.exec(linha)
    if (prova && atual) atual.prova = prova[1].trim()
  }

  return lista
}

function shaDosCriterios(lista) {
  const normalizado = lista.map((c) => `${c.id}|${c.texto}|${c.prova ?? "-"}`).join("\n")
  return createHash("sha256").update(normalizado).digest("hex")
}

/** Resolve a prova declarada: o arquivo/teste existe mesmo? */
function resolver(prova) {
  if (!prova) return { tipo: null, alvo: null, resolvido: false, motivo: "sem prova declarada" }

  const [tipo, alvo] = prova.split(":")

  if (tipo === "unit") {
    const existe = existsSync(join(raiz, alvo))

    return { tipo, alvo, resolvido: existe, motivo: existe ? null : `arquivo ausente: ${alvo}` }
  }

  if (tipo === "jornada") {
    const [nome, passo] = alvo.split("@")
    const arquivo = join(raiz, "e2e", "jornadas", `${nome}.spec.ts`)

    if (!existsSync(arquivo)) {
      return { tipo, alvo, resolvido: false, motivo: `jornada ausente: ${nome}` }
    }

    const contemPasso = !passo || readFileSync(arquivo, "utf8").includes(`test.step("${passo}"`)

    return {
      tipo,
      alvo,
      resolvido: contemPasso,
      motivo: contemPasso ? null : `passo ausente na jornada: ${passo}`,
    }
  }

  if (tipo === "api") {
    return { tipo, alvo, resolvido: false, motivo: "nivel api ainda nao implementado (fase E)" }
  }

  return { tipo, alvo, resolvido: false, motivo: `tipo de prova desconhecido: ${tipo}` }
}

const specs = []

for (const entrada of readdirSync(specsDir, { withFileTypes: true })) {
  if (!entrada.isDirectory()) continue

  const arquivo = join(specsDir, entrada.name, "requisito.md")
  if (!existsSync(arquivo)) continue

  const texto = readFileSync(arquivo, "utf8")
  const front = frontmatter(texto)
  const cas = criterios(texto)
  const sha = shaDosCriterios(cas)

  specs.push({
    id: front.id ?? entrada.name,
    pasta: relative(raiz, join(specsDir, entrada.name)),
    estado: front.estado ?? "rascunho",
    retroativo: front.retroativo === "true",
    aprovado_por: front.aprovado_por ?? null,
    aprovado_sha: front.aprovado_sha ?? null,
    sha_atual: sha,
    criterios: cas.map((c) => ({ ca: c.id, texto: c.texto, prova: c.prova, ...resolver(c.prova) })),
  })
}

const shaPedido = process.argv.indexOf("--sha")

if (shaPedido >= 0) {
  const id = process.argv[shaPedido + 1]
  const spec = specs.find((s) => s.id === id)

  if (!spec) {
    console.error(`spec ${id} nao encontrada em spec/`)
    process.exit(1)
  }

  console.log(spec.sha_atual)
  process.exit(0)
}

const totalCa = specs.reduce((n, s) => n + s.criterios.length, 0)
const provados = specs.reduce((n, s) => n + s.criterios.filter((c) => c.resolvido).length, 0)
const json =
  JSON.stringify({ gerado_de: "spec/**/requisito.md", total_specs: specs.length, total_ca: totalCa, provados, specs }, null, 2) +
  "\n"
const caminho = resolve(raiz, destino)

if (process.argv.includes("--check")) {
  const problemas = []

  for (const spec of specs) {
    if (spec.estado === "aprovado" && spec.aprovado_sha !== spec.sha_atual) {
      problemas.push(
        `${spec.id}: criterios mudaram depois da aprovacao (sha ${spec.aprovado_sha} -> ${spec.sha_atual})`
      )
    }

    for (const c of spec.criterios.filter((x) => !x.resolvido)) {
      problemas.push(`${spec.id}/${c.ca}: ${c.motivo}`)
    }
  }

  let atual = ""

  try {
    atual = readFileSync(caminho, "utf8")
  } catch {
    problemas.push(`${destino} nao existe`)
  }

  if (atual && atual !== json) problemas.push(`${destino} desatualizado`)

  if (problemas.length === 0) {
    console.log(`  ok   rastreio em dia (${specs.length} spec(s), ${provados}/${totalCa} CA com prova)`)
    process.exit(0)
  }

  console.error("  FAIL rastreio:\n" + problemas.map((p) => `       - ${p}`).join("\n") + "\n  Rode: node scripts/gen-traceability.mjs")
  process.exit(1)
}

writeFileSync(caminho, json)
console.log(`Gerado ${destino} (${specs.length} spec(s), ${provados}/${totalCa} CA com prova).`)
