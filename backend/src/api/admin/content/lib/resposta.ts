/** A forma da recusa desta API: o `{ type, message }` que o CRM lê. */
import type { MedusaResponse } from "@medusajs/framework/http"

/** Os `type` que o CRM conhece. O 500 de estado gravado é `invalid_data`. */
export type TipoDeRecusa = "invalid_data" | "not_found"

/**
 * Responde a recusa — e é **o único lugar** que monta este corpo: a rota tinha
 * doze cópias do mesmo `res.status(400).json({ type, message })`.
 */
export function recusar(
  res: MedusaResponse,
  message: string,
  {
    status = 400,
    type = "invalid_data",
  }: { status?: number; type?: TipoDeRecusa } = {}
): void {
  res.status(status).json({ type, message })
}
