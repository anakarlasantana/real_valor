import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { scriptFlags } from "./flags"
import {
  conferirContrato,
  gravarContrato,
  gravarConteudo,
} from "./seed/conteudo"
import { prepararLoja } from "./seed/loja"

/**
 * O **único** comando de seed da loja.
 * -------------------------------------------------------------------------
 *   make seed                      # do zero ao app usável
 *   yarn check-schema              # só confere o contrato (é o que a CI roda)
 *   yarn seed -- --contrato        # grava só o registro do contrato
 *   yarn seed -- --force           # recria as superfícies de conteúdo
 *
 * Ele prepara o mínimo para o painel ter o que editar — e nada de catálogo:
 * produto, categoria, coleção e página são do lojista.
 *
 * Os três blocos, nesta ordem: **loja** (canal, moeda, região, local, vínculos,
 * envio, caixa, chave), **conteúdo** (vitrine, tema) e **contrato** (o schema
 * que o CRM desenha). Todos idempotentes: rodar duas vezes deixa o banco no
 * mesmo estado.
 *
 * O `--check` compara o registro do contrato sem gravar e sai com código 1 na
 * divergência: é assim que "mudei o contrato e esqueci de rodar o seed" vira
 * falha de build, em vez de um schema velho servindo formulário velho.
 */
export default async function seed({
  container,
  args,
}: ExecArgs & { args?: string[] }): Promise<void> {
  const flags = scriptFlags(args)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (flags.includes("--check")) {
    process.exitCode = await conferirContrato(container)
    return
  }

  // `--contrato`: só o registro (é o passo que a CI precisa, num banco efêmero).
  if (flags.includes("--contrato")) {
    await gravarContrato(container)
    return
  }

  await prepararLoja(container)
  await gravarConteudo(container, { forcar: flags.includes("--force") })
  await gravarContrato(container)

  // Fecha conferindo: o que acabou de ser gravado tem de casar com o contrato.
  process.exitCode = await conferirContrato(container)

  logger.info(
    "[Real Valor] loja pronta — painel em http://localhost:9000/painel. " +
      "O catálogo é seu: cadastre a primeira peça por lá."
  )
}
