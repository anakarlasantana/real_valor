import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Informações institucionais e de pagamento da Loja Real Valor
 * GET /store/custom/checkout-info
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
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
      installments: {
        max_installments: 12,
        interest_free_installments: 3,
      },
      pix_discount_percentage: 5,
    },
  })
}
