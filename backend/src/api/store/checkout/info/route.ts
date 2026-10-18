import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { documentoValido } from "@rv/contrato"

/** O institucional e o de pagamento da loja.
 * `documento_presente` vem do banco: o `metadata` do navegador pode estar velho. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId =
    typeof req.query.cart_id === "string" ? req.query.cart_id : undefined

  let documentoPresente = false

  if (cartId) {
    try {
      const cartModuleService = req.scope.resolve(Modules.CART)
      const cart = await cartModuleService.retrieveCart(cartId)

      documentoPresente = documentoValido(
        (cart?.metadata as Record<string, unknown> | null)?.cpf
      )
    } catch {
      documentoPresente = false
    }
  }

  res.json({
    store: {
      name: "Real Valor Modas",
      tagline: "Moda Feminina Autêntica e Elegante",
      document_cnpj: "00.000.000/0001-00",
      whatsapp_support: "+55 (11) 99999-9999",
      email_support: "atendimento@realvalor.com.br",
      address: "São Paulo, SP - Brasil",
    },
    checkout_policy: {
      no_login_required: true,
      accepted_documents: ["CPF"],
      // Exigido: sem ele a etiqueta não é emitida.
      document_required: true,
      documento_presente: documentoPresente,
      installments: {
        max_installments: 12,
        interest_free_installments: 3,
      },
      pix_discount_percentage: 5,
    },
  })
}
