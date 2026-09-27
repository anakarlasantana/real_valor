/**
 * As flags passadas para um script do `medusa exec`.
 * -------------------------------------------------------------------------
 * Por que não `ExecArgs.args` direto: nesta versão do CLI ele chega **vazio**,
 * mesmo com o separador (`medusa exec ./src/scripts/x.ts -- --check`): o
 * `medusa exec` engole o que vem depois do script, e sem o separador o yargs
 * trata a flag como opção dele e imprime o ajuda. `process.argv` é o que
 * preserva o que a pessoa digitou.
 *
 * `args` continua no `||` como plano B para chamada programática — e porque é
 * ele que a assinatura de `ExecArgs` promete; o que muda é que não é de onde a
 * flag vem na prática.
 *
 * Um lugar só porque a tentação é reescrever a mesma linha em cada script, e o
 * `--force` do `seed-content` estava documentado e não funcionava justamente por
 * causa dessa leitura.
 */
export function scriptFlags(args?: string[]): string[] {
  const fromArgv = process.argv.slice(2).filter((arg) => arg.startsWith("--"))

  return [...(args ?? []), ...fromArgv]
}
