/**
 * A suíte do CRM: o que existe em `admin/src` é o que o runner do CRM roda.
 * -------------------------------------------------------------------------
 * A R2 tirou o teste do painel do `roots` do jest do backend (que apontava para
 * `../admin/src`) e deu ao CRM runner próprio (`admin/jest.config.js`), chamado
 * pelo alvo `test` do Makefile. A pergunta que fica — e que este script
 * responde — é a mesma que motivou a mudança: **alguma suíte do CRM deixou de
 * ser executada sem ninguém notar?**
 *
 * O jest já reprova sozinho o caso extremo: sem nenhum teste casando com o
 * `testMatch`, ele sai com "No tests found" e `make test` falha (medido: com um
 * `--testMatch` que não casa, exit 1). O que ele **não** vê é a perda parcial —
 * um `testMatch` que ficou estreito num ajuste, ou um arquivo renomeado para um
 * sufixo que o padrão não cobre (`.unit.spec.ts` → `.spec.ts`): nos dois casos a
 * suíte continua no disco, o `make test` continua verde e passa a rodar menos.
 *
 * Por isso a varredura do disco é MAIS LARGA que o `testMatch` do runner: aqui
 * vale qualquer `*.spec.*`/`*.test.*` sob `admin/src`. Um spec que o runner do
 * CRM não pega reprova este script em vez de sumir — quem o escreveu decide o
 * que é o certo: renomear para a convenção do painel (`.unit.spec`) ou alargar
 * o `testMatch` de `admin/jest.config.js`. O contrário também é verificado: o
 * runner do CRM não lista nada fora de `admin/src`.
 *
 * Rode com:
 *   node scripts/check-panel-tests.mjs
 *
 * É a linha seguinte ao jest do CRM no alvo `test` do Makefile — e **não** no
 * `make check`: este script invoca o jest, então precisa de `node_modules`, e o
 * alvo `check` (que o hook de commit e o job `guard` da CI rodam) existe
 * justamente para rodar em segundos sem instalar nada.
 *
 * Não usa framework de teste de propósito, como as outras guardas de `scripts/`.
 */
import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PANEL = join(ROOT, "admin")
const PANEL_SRC = join(PANEL, "src")

/** Todo spec do CRM no disco, em ordem estável, como caminhos do repositório. */
function specsOnDisk(dir = PANEL_SRC) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        return specsOnDisk(path)
      }

      return /\.(spec|test)\.[jt]sx?$/.test(entry.name)
        ? [relative(ROOT, path)]
        : []
    })
    .sort()
}

/** O que o runner do CRM diz que vai rodar — sem rodar. */
function specsTheRunnerSees() {
  // O binário e o config são os mesmos que o alvo `test` do Makefile usa: o que
  // este script mede é a superfície que `make test` executa, não uma parecida.
  const output = execFileSync(
    join(ROOT, "backend", "node_modules", ".bin", "jest"),
    ["-c", "jest.config.js", "--listTests"],
    { cwd: PANEL, encoding: "utf8" }
  )

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((path) => relative(ROOT, path))
    .sort()
}

const onDisk = specsOnDisk()
const seen = specsTheRunnerSees()

if (onDisk.length === 0) {
  console.log("  FAIL nenhum teste encontrado em admin/src")
  console.log("       Um pacote sem teste passa por aqui em silêncio. Se a suíte do CRM")
  console.log("       deixou de existir, a decisão é explícita — não um diretório vazio.")
  process.exit(1)
}

const semExecutor = onDisk.filter((spec) => !seen.includes(spec))
const forasteiros = seen.filter((spec) => !onDisk.includes(spec))

if (semExecutor.length > 0) {
  console.log("  FAIL todo teste do CRM é executado por quem é dono dele")
  for (const spec of semExecutor) {
    console.log(`       ${spec}: está em admin/src e o runner do CRM não o lista`)
  }
  console.log("       Um spec que ninguém roda é documentação. Ver admin/jest.config.js.")
  process.exit(1)
}

if (forasteiros.length > 0) {
  console.log("  FAIL o runner do CRM roda só o teste do CRM")
  for (const spec of forasteiros) {
    console.log(`       ${spec}: o runner do CRM lista um arquivo de fora dele`)
  }
  process.exit(1)
}

console.log(
  `  ok   o runner do CRM roda a suíte do CRM: ${onDisk.length} arquivo(s) — ${onDisk.join(", ")}`
)
