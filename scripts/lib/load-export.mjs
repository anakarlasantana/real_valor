/**
 * Carrega um export de um módulo TypeScript do backend, de um script `.mjs`.
 * -------------------------------------------------------------------------
 * Os scripts deste diretório rodam em Node puro — o `make check` não instala
 * nada e não sobe container —, e o que torna isso possível é o type-stripping
 * nativo: o Node apaga os tipos, e o valor volta por stdout, serializado em
 * JSON. É o que permite a guarda comparar **dados** (a paleta, os campos, as
 * estações) em vez de texto.
 *
 * **Por que um hook de resolução.** Um módulo que importa outro sem extensão
 * (`import { … } from "./contract"`, como o `tsc` do backend exige) não resolve
 * em ESM puro: o Node procura o arquivo literalmente e responde
 * `ERR_MODULE_NOT_FOUND` — medido. Era essa a razão de `themes.ts` importar o
 * contrato **só como tipo** até a R3-lite: o valor nunca era buscado e o import
 * sumia no carregamento. Desde a R4 ele importa valor (a paleta e as fontes do
 * contrato), então o processo filho registra um hook que **completa** o
 * especificador relativo sem extensão com `.ts` quando a resolução normal
 * falha. O `tsc` continua vendo `./contract` como sempre viu; quem ganha a
 * extensão é só este carregamento.
 *
 * O hook mora num diretório temporário, junto do `entry.mjs`: nada disto entra
 * no repositório, e dois carregamentos em paralelo não disputam arquivo. O
 * `__MISSING__` no filho separa "o módulo não exporta isso" (erro de quem
 * chamou) de "o módulo não carregou" (erro dentro dele).
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

/** O hook: só completa `./x` → `./x.ts`; o resto da resolução é a do Node. */
const RESOLVE_HOOK = `
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    if (specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + ".ts", context)
    }
    throw error
  }
}
`

/**
 * Roda uma expressão no processo filho, com o módulo já carregado em `mod`.
 *
 * O `__MISSING__` sai do filho com código 3 para separar "o módulo não exporta
 * isso" (erro de quem chamou) de "o módulo não carregou" (erro dentro dele).
 */
function evaluate(file, { name, expression }) {
  const dir = mkdtempSync(join(tmpdir(), "rv-load-"))
  const entry = join(dir, "entry.mjs")
  const hook = join(dir, "resolve-ts.mjs")
  // `pathToFileURL` do caminho resolvido: um caminho relativo viraria
  // `file://./…`, que o Node recusa com `ERR_INVALID_FILE_URL_HOST` — um erro
  // que não diz nada a quem chamou. Quem chama hoje passa caminho absoluto,
  // mas o carregador é compartilhado: melhor não depender disso.
  const target = pathToFileURL(resolve(file)).href

  const body = `
    import { register } from "node:module";
    register(${JSON.stringify(pathToFileURL(hook).href)});
    const mod = await import(${JSON.stringify(target)});
    const value = ${expression};
    if (value === undefined) {
      console.error("__MISSING__:" + ${JSON.stringify(name)});
      process.exit(3);
    }
    process.stdout.write(JSON.stringify(value));
  `

  writeFileSync(hook, RESOLVE_HOOK)
  writeFileSync(entry, body)
  const result = spawnSync("node", [entry], { encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })

  if (result.status === 3) {
    throw new Error(
      `${file} não exporta "${name}". ` +
        `Erro de compilação:\n${result.stderr}`
    )
  }

  if (result.status !== 0) {
    throw new Error(
      `Falha ao importar ${name} de ${file}:\n${result.stderr || result.stdout}`
    )
  }

  return JSON.parse(result.stdout)
}

/**
 * O valor de `exportName` em `file`, já desserializado.
 *
 * Lança quando o módulo não carrega (erro de sintaxe, import que não resolve)
 * ou quando o export não existe — os dois são erro de contrato, e a mensagem
 * diz qual dos dois foi.
 */
export function loadExport(file, exportName) {
  return evaluate(file, {
    name: exportName,
    expression: `mod[${JSON.stringify(exportName)}]`,
  })
}

/**
 * `exportName(...args)` chamado em `file`, com o retorno desserializado.
 *
 * Existe porque nem todo dado é constante: o schema do CRM é o **resultado** de
 * `buildSchema()` a partir do contrato, e JSON não serializa função. Chamar a
 * função é o que permite a guarda comparar o payload que a API serve com as
 * constantes que o contrato declara, em vez de procurar as linhas no arquivo.
 */
export function callExport(file, exportName, args = []) {
  return evaluate(file, {
    name: exportName,
    expression: `mod[${JSON.stringify(exportName)}](...${JSON.stringify(args)})`,
  })
}
