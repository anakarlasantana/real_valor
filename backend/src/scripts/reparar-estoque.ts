import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"

import { criarVinculo } from "./seed/vinculo"

/**
 * Repara o estoque dos produtos que o painel criou sem inventário (RV-030):
 * variant sem inventory item tem `inventory_quantity` ausente, e a loja lê
 * ausente como zero — o produto aparece **esgotado** sem ninguém decidir isso.
 */
export default async function repararEstoque({
  container,
  args,
}: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventory = container.resolve(Modules.INVENTORY)
  const storeModule = container.resolve(Modules.STORE)

  const bruto = (args ?? []) as string[]
  const aplicar = bruto.includes("--aplicar")
  const indice = bruto.indexOf("--quantidade")
  const quantidade = indice >= 0 ? Number(bruto[indice + 1] ?? 0) : 0

  if (!Number.isFinite(quantidade) || quantidade < 0) {
    throw new Error("--quantidade precisa ser um número maior ou igual a zero.")
  }

  const [loja] = await storeModule.listStores()
  const local = loja?.default_location_id

  if (!local) {
    throw new Error(
      "A loja não tem local de estoque padrão. Rode `make seed` uma vez, ou defina o local no painel."
    )
  }

  // Todos os variants que JÁ têm item de inventário: o que falta é o resto.
  const { data: existentes } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id"],
  })

  const vinculados = new Set(
    (existentes ?? []).map((linha: { variant_id?: string }) => linha.variant_id)
  )

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku"],
  })

  const soltos = (variants ?? []).filter(
    (variant: { id: string }) => !vinculados.has(variant.id)
  )

  logger.info(
    `[Real Valor] ${soltos.length} variant(s) sem inventário vinculado.`
  )

  if (soltos.length === 0) {
    return
  }

  for (const variant of soltos as { id: string; sku?: string | null }[]) {
    logger.info(`  · variant ${variant.id}`)

    if (!aplicar) {
      continue
    }

    const [item] = await inventory.createInventoryItems([
      { sku: variant.sku || variant.id },
    ])

    await criarVinculo(container, {
      [Modules.PRODUCT]: { variant_id: variant.id },
      [Modules.INVENTORY]: { inventory_item_id: item.id },
    })

    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: item.id,
            location_id: local,
            stocked_quantity: quantidade,
          },
        ],
      },
    })
  }

  if (!aplicar) {
    logger.info(
      "[Real Valor] Simulação: nada foi gravado. Rode com `-- --aplicar` para aplicar."
    )
    return
  }

  logger.info(
    `[Real Valor] ${soltos.length} variant(s) vinculado(s), com ${quantidade} unidade(s) no local ${local}.`
  )
}
