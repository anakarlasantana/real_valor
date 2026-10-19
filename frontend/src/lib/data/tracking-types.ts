/**
 * A resposta de `GET /store/orders/track`, em português.
 *
 * Espelha o que a rota devolve (`backend/src/api/store/orders/track/route.ts`):
 * renomear aqui sem renomear lá faria o campo virar `undefined` em silêncio.
 */
export type SituacaoRastreio = {
  /** A situação que o painel ou o webhook gravou ("Postada", "Cancelado"). */
  order_status_label: string
  /** O estado da máquina no SuperFrete (`posted`). `null` sem etiqueta. */
  situacao: string | null
  /** Decidido pelo backend — a tela nunca infere cancelamento. */
  cancelado: boolean
}

export type ItemRastreio = {
  id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail?: string | null
}

export type RastreioDoPedido = {
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
}

export type RespostaRastreio = {
  order: {
    id: string
    display_id: number
    email: string
    status: string
    payment_status: string
    created_at: string
    items: ItemRastreio[]
    tracking: RastreioDoPedido
    metadata: SituacaoRastreio
  }
}