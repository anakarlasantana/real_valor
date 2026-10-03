/**
 * A resposta de `GET /store/orders/track`, em português.
 *
 * espelha o que a rota devolve (`backend/src/api/store/orders/track/route.ts`).
 * Os nomes seguem a rota de propósito: renomear aqui sem renomear lá faria o
 * `dados.order.title` virar `undefined` em silêncio, e a página mostraria um
 * pedido sem nome sem nenhum erro.
 *
 * Tudo que é opcional **é** opcional de verdade: um pedido recém-pago não tem
 * rastreio, e a página precisa saber lidar com a ausência sem quebrar.
 */
export type SituacaoRastreio = {
  /** A situação que o lojista escreveu no painel ("Entregue", "Em trânsito"). */
  order_status_label: string
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