/** O texto que recusa um estorno, com a instrução de onde fazê-lo. */
import { idMascarado } from "./redigir"

/** A instrução de estorno, com o pagamento o mais identificável sem PII. */
export function instrucaoDeEstorno(
  pagamento: Record<string, unknown> | undefined
): string {
  return (
    "O estorno é feito no painel do Mercado Pago. " +
    `Procure o pagamento ${idMascarado(pagamento?.id)} (R$ ` +
    `${Number(pagamento?.transaction_amount ?? 0).toFixed(2)}) em ` +
    "Atividade → Pagamentos e estorne por lá."
  )
}
