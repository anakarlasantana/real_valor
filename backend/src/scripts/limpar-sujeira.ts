import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductsWorkflow,
  deleteShippingOptionsWorkflow,
  deleteStockLocationsWorkflow,
  updateStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"

import { scriptFlags } from "./flags"
import { ENDERECO_ORIGEM, SERVICOS_MINIMOS } from "./seed/loja"
import {
  localQueFica,
  locaisExcedentes,
  opcoesForaDoMinimo,
  opcoesLegadas,
  produtosDoSeedAntigo,
  type LocalResumo,
  type NiveisPorLocal,
  type OpcaoResumo,
  type ProdutoResumo,
} from "./seed/sujeira"

/**
 * Apaga o resíduo do seed antigo. **Não** é seed: é manutenção, e é opt-in.
 * -------------------------------------------------------------------------
 *   make seed-limpar                 # mostra o que sairia (dry-run)
 *   yarn limpar-sujeira -- --aplicar # apaga
 *
 * Três alvos, todos medida de 16/11/2026 nesta base:
 *
 *   1. **catálogo de demonstração** (3 peças do seed removido em 08/10) — só
 *      com zero pedidos, porque apagar produto com histórico é perda de dado;
 *   2. **locais de estoque duplicados** (eram 7, todos com o mesmo nome) — a
 *      loja soma os locais, então o estoque aparecia dobrado; fica o que tem
 *      estoque, e só saem os **vazios**;
 *   3. **opções de frete `manual/flat`** — o SuperFrete as substituiu; elas
 *      ficam desligadas e só sujam a tela de serviços.
 */
export default async function limparSujeira({
  container,
  args,
}: ExecArgs & { args?: string[] }): Promise<void> {
  const aplicar = scriptFlags(args).includes("--aplicar")
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: produtos } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const { data: pedidos } = await query.graph({ entity: "order", fields: ["id"] })
  const { data: locais } = await query.graph({
    entity: "stock_location",
    fields: ["id", "created_at", "address.postal_code", "address.city"],
  })
  const { data: niveis } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "location_id"],
  })
  const { data: opcoes } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "provider_id", "price_type", "data"],
  })

  const niveisPorLocal = (niveis ?? []).reduce<NiveisPorLocal>((mapa, nivel) => {
    const chave = String((nivel as { location_id?: string }).location_id ?? "")
    mapa[chave] = (mapa[chave] ?? 0) + 1
    return mapa
  }, {})

  const produtosAlvo = produtosDoSeedAntigo((produtos ?? []) as ProdutoResumo[])
  const locaisAlvo = locaisExcedentes(
    (locais ?? []) as LocalResumo[],
    niveisPorLocal
  )
  const opcoesAlvo = [
    ...opcoesLegadas((opcoes ?? []) as OpcaoResumo[]),
    ...opcoesForaDoMinimo(
      (opcoes ?? []) as OpcaoResumo[],
      SERVICOS_MINIMOS.map((servico) => servico.servico)
    ),
  ]

  logger.info(
    `[limpeza] produtos de demonstração: ${produtosAlvo.length} · ` +
      `locais duplicados: ${locaisAlvo.length} · ` +
      `opções de frete legadas: ${opcoesAlvo.length} · ` +
      `pedidos na base: ${pedidos?.length ?? 0}`
  )

  if ((pedidos?.length ?? 0) > 0 && produtosAlvo.length) {
    logger.warn(
      "[limpeza] há pedidos nesta base — os produtos de demonstração NÃO serão " +
        "apagados (histórico). Os locais vazios e as opções legadas seguem."
    )
  }

  if (!aplicar) {
    logger.info(
      "[limpeza] dry-run. Nada foi apagado. Rode com --aplicar (ou " +
        "`make seed-limpar`) para apagar."
    )
    return
  }

  if (produtosAlvo.length && (pedidos?.length ?? 0) === 0) {
    await deleteProductsWorkflow(container).run({
      input: { ids: produtosAlvo },
    })
  }

  if (locaisAlvo.length) {
    await deleteStockLocationsWorkflow(container).run({
      input: { ids: locaisAlvo },
    })
  }

  if (opcoesAlvo.length) {
    await deleteShippingOptionsWorkflow(container).run({
      input: { ids: opcoesAlvo },
    })
  }

  // O endereço do seed antigo era fictício (Avenida Paulista). A cotação sai do
  // CEP do local, então alinhar aqui é o que faz o frete sair de Fortaleza.
  const fica = localQueFica((locais ?? []) as LocalResumo[], niveisPorLocal)
  const endereco = (locais ?? []).find(
    (local) => (local as { id?: string }).id === fica
  ) as { address?: { postal_code?: string } } | undefined

  if (fica && endereco?.address?.postal_code !== ENDERECO_ORIGEM.postal_code) {
    await updateStockLocationsWorkflow(container).run({
      input: {
        selector: { id: fica },
        update: { address: { ...ENDERECO_ORIGEM } },
      },
    })

    logger.info(
      `[limpeza] endereço de origem alinhado: ${ENDERECO_ORIGEM.city}/` +
        `${ENDERECO_ORIGEM.province} · ${ENDERECO_ORIGEM.postal_code}.`
    )
  }

  logger.info(
    `[limpeza] apagados: ${produtosAlvo.length} produto(s) de demonstração, ` +
      `${locaisAlvo.length} local(is) vazio(s), ${opcoesAlvo.length} opção(ões) legada(s). ` +
      `Local que fica: ${localQueFica((locais ?? []) as LocalResumo[], niveisPorLocal) ?? "(nenhum)"}.`
  )
}
