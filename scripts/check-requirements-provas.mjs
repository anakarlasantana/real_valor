/** Valida as provas `prova:` do docs/real-valor/04-requisitos-funcionais.md.
 *  - `unit:caminho` -> verifica se o arquivo existe
 *  - `jornada:nome@passo` -> verifica se o spec da jornada existe e o passo está nele
 *  Sai com código 1 se houver alguma prova não resolvida.
 *
 *  Rode: `node scripts/check-requirements-provas.mjs`
 *  Ou adicione em `make check` como nova guarda.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const raiz = "/home/sn-387116/Documents/real_valor"
const doc = join(raiz, "docs", "real-valor", "04-requisitos-funcionais.md")

const conteúdo = readFileSync(doc, "utf8")

// Expressão para capturar o tipo e o alvo da prova: `tipo:alvo`
// As linhas podem ter recuo (spaces/tabs) no início
const regex = /^\s*prova:\s*`([^`]+)`/gm

let match
let problemas = []
let numeroLinha = 0

while ((match = regex.exec(conteúdo)) !== null) {
  numeroLinha = regex.lastIndex
  const prova = match[1].trim()
  // O tipo e' o que vem antes do PRIMEIRO dois-pontos; o alvo pode ter mais
  // (`evidência: sem 5xx…`), por isso `slice` e nao `split` — `split(…, 2)`
  // cortava o alvo e a guarda reprovava prova que existia.
  const corte = prova.indexOf(":")
  const tipo = prova.slice(0, corte)
  const alvo = prova.slice(corte + 1)
  const tipoLimpo = tipo.trim()
  const alvoLimpo = alvo ? alvo.trim() : ""

  if (!tipoLimpo || !alvoLimpo) {
    problemas.push(`linha ${numeroLinha}: prova mal formatada: \`${prova}\``)
    continue
  }

  let resolvido = false
  let motivo = ""

  if (tipoLimpo === "unit") {
    // Para unit:, verifica se o arquivo existe na raiz do repositório
    const caminhoArquivo = join(raiz, alvoLimpo)
    resolvido = existsSync(caminhoArquivo)
    motivo = resolvido ? null : `arquivo ausente: \`${alvoLimpo}\``
  } else if (tipoLimpo === "jornada") {
    // Para jornada:, o formato é nome@passo
    const indiceArroba = alvoLimpo.indexOf("@")
    if (indiceArroba === -1) {
      problemas.push(`linha ${numeroLinha}: jornada sem @passo: \`${prova}\``)
      continue
    }
    const [nomeJornada, passo] = [alvoLimpo.substring(0, indiceArroba), alvoLimpo.substring(indiceArroba + 1)]
    const arquivoJornada = join(raiz, "e2e", "jornadas", `${nomeJornada}.spec.ts`)

    if (!existsSync(arquivoJornada)) {
      problemas.push(`linha ${numeroLinha}: jornada ausente: \`${nomeJornada}\``)
      continue
    }

    const textoJornada = readFileSync(arquivoJornada, "utf8")
    // Nota: simples check de string; para produção usaria parser adequado
    resolvido = !passo || textoJornada.includes(`test.step("${passo}"`)
    motivo = resolvido ? null : `passo ausente na jornada: \`${passo}\``
  } else {
    problemas.push(`linha ${numeroLinha}: tipo de prova desconhecido: \`${tipoLimpo}\``)
    continue
  }

  if (!resolvido) {
    problemas.push(`CRITério sem prova resolvida: ${prova} — ${motivo}`)
  }
}

if (problemas.length > 0) {
  console.error("FAIL provas do requisito 04:\\n" + problemas.join("\n"))
  process.exit(1)
} else {
  console.log(`ok   provas validadas — todas resolvidas no docs/real-valor/04-requisitos-funcionais.md`)
  process.exit(0)
}