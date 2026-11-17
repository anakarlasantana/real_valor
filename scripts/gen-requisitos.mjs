/** Índice de requisitos — derivado do doc 04 (a fonte é o Markdown).
 *  node scripts/gen-requisitos.mjs          → regrava requisitos.json
 *  node scripts/gen-requisitos.mjs --check  → exit 1 se estiver velho
 *  Por que `CA-n` e `prova:`: doc 20, "requisito → prova".
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fonte = "docs/real-valor/04-requisitos-funcionais.md"
const destino = "docs/real-valor/requisitos.json"

const ansi = (t) => t.replace(/\u001b\[[0-9;]*m/g, "")

function extrair(texto) {
  const requisitos = []
  let atual = null
  let emCriterios = false

  for (const linha of texto.split("\n")) {
    const titulo = /^## (RV-\d{3})\s*[—–-]\s*(.+)$/.exec(linha)

    if (titulo) {
      if (atual) requisitos.push(atual)

      const bruto = ansi(titulo[2]).trim()
      const feito = /✅\s*feito/i.test(bruto)

      atual = {
        id: titulo[1],
        titulo: bruto.replace(/\s*✅.*$/i, "").trim(),
        prioridade: null,
        estado: feito ? "feito" : "pendente",
        criterios: [],
      }
      emCriterios = false
      continue
    }

    if (!atual) continue

    const prioridade = /\*\*Prioridade:\*\*\s*([A-ZÁÂÃÉÊÍÓÔÕÚÇ]+)/.exec(linha)
    if (prioridade && !atual.prioridade) atual.prioridade = prioridade[1]

    const status = /\*\*Status:\*\*\s*([^\n·]+)/i.exec(linha)
    if (status && /feito|conclu/i.test(status[1])) atual.estado = "feito"

    if (/^###\s+Crit[eé]rios de aceite\s*$/i.test(linha)) {
      emCriterios = true
      continue
    }

    if (/^#{2,3}\s/.test(linha)) {
      emCriterios = false
      continue
    }

    if (!emCriterios) continue

    const item = /^(\d+)\.\s+(.*)$/.exec(linha)

    if (item) {
      atual.criterios.push({ numero: Number(item[1]), texto: item[2].trim() })
      continue
    }

    // Item quebrado em várias linhas: continua o anterior.
    if (atual.criterios.length > 0 && /^\s{2,}\S/.test(linha)) {
      const ultimo = atual.criterios[atual.criterios.length - 1]
      ultimo.texto = `${ultimo.texto} ${linha.trim()}`.trim()
    }
  }

  if (atual) requisitos.push(atual)

  return requisitos.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    prioridade: r.prioridade ?? "NAO-DECLARADA",
    estado: r.estado,
    criterios: r.criterios.map((c, i) => {
      const prova = /\bprova:\s*`?([a-z]+:[^`\n]+)`?/i.exec(c.texto)

      return {
        id: `CA-${i + 1}`,
        texto: c.texto.replace(/\s*\bprova:\s*`?[a-z]+:[^`\n]+`?/i, "").trim(),
        prova: prova ? prova[1].trim() : null,
      }
    }),
  }))
}

const texto = readFileSync(resolve(raiz, fonte), "utf8")
const requisitos = extrair(texto)
const json = JSON.stringify({ fonte, total: requisitos.length, requisitos }, null, 2) + "\n"
const caminho = resolve(raiz, destino)

if (process.argv.includes("--check")) {
  let atual = ""

  try {
    atual = readFileSync(caminho, "utf8")
  } catch {
    console.error(`  FAIL ${destino} não existe. Rode: node scripts/gen-requisitos.mjs`)
    process.exit(1)
  }

  if (atual === json) {
    console.log(`  ok   requisitos em dia (${requisitos.length} requisito(s))`)
    process.exit(0)
  }

  const assinatura = (lista) =>
    (lista ?? []).map(
      (r) =>
        `${r.id} · ${r.estado} · ${(r.criterios ?? []).length} CA · ` +
        (r.criterios ?? []).map((c) => c.texto).join("|").length
    )

  const antes = new Set(assinatura(JSON.parse(atual).requisitos))
  const depois = new Set(assinatura(requisitos))
  const removidos = [...antes].filter((r) => !depois.has(r))
  const adicionados = [...depois].filter((r) => !antes.has(r))

  console.error(
    `  FAIL ${destino} desatualizado:\n` +
      removidos.slice(0, 6).map((m) => `       - ${m}`).join("\n") +
      (removidos.length ? "\n" : "") +
      adicionados.slice(0, 6).map((m) => `       + ${m}`).join("\n") +
      "\n  Rode: node scripts/gen-requisitos.mjs"
  )
  process.exit(1)
}

writeFileSync(caminho, json)
console.log(
  `Gerado ${relative(raiz, caminho)} (${requisitos.length} requisitos, ` +
    `${requisitos.reduce((n, r) => n + r.criterios.length, 0)} critérios).`
)
