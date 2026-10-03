/**
 * O que a rota de envio devolve, em pt-BR.
 *
 * Os nomes seguem a resposta do backend (`api/admin/shipping/route.ts`) e a
 * forma do resumo é a mesma de `shippingSummary`, em
 * `backend/src/modules/shipping/tracking.ts`. A distinção entre
 * `carrier`/`trackingNumber` e `tracking_number` existe porque o painel fala
 * português e o `metadata` é snake_case por contrato do Medusa.
 */
export type ResumoEnvio = {
  enviado: boolean
  carrier: string
  trackingNumber: string
  trackingUrl: string
  statusLabel: string
}

export type PedidoEnvio = {
  id: string
  display_id: number
  email: string
  status: string
  payment_status: string
  created_at: string
  resumo: string
  envio: ResumoEnvio
}