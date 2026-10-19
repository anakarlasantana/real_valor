/** O vínculo etiqueta → pedido: `listOrders` não filtra por `metadata`. */

export type PedidoNoVinculo = {
  id: string
  display_id?: number | null
  metadata?: Record<string, unknown> | null
}


/** Idade máxima de um pedido que ainda pode receber aviso de etiqueta. */
export const DIAS_DE_JANELA = 120

/** Quantos pedidos a varredura lê por vez. */
export const TAMANHO_DA_PAGINA = 200

/** O pedido desta etiqueta. `skip`/`take` são config e a data usa `$gte`. */
export async function pedidoDaEtiqueta({
  etiqueta,
  listar,
  hoje = new Date(),
}: {
  etiqueta: string
  listar: (
    filtro: { created_at: { $gte: string } },
    config: { skip: number; take: number }
  ) => Promise<PedidoNoVinculo[]>
  hoje?: Date
}): Promise<string | null> {
  const alvo = etiqueta.trim()
  const maisAntigo = new Date(hoje.getTime() - DIAS_DE_JANELA * 86_400_000).toISOString()

  for (let skip = 0; ; skip += TAMANHO_DA_PAGINA) {
    const pagina = await listar(
      { created_at: { $gte: maisAntigo } },
      { skip, take: TAMANHO_DA_PAGINA }
    )

    const achado = pagina.find(
      (pedido) => String(pedido.metadata?.superfrete_id ?? "").trim() === alvo
    )

    if (achado) return achado.id
    if (pagina.length < TAMANHO_DA_PAGINA) return null
  }
}
