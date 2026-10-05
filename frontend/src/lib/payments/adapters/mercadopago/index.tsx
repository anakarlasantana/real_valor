"use client"

/**
 * Os adapters do Mercado Pago — Checkout Pro (redirecionamento).
 * -------------------------------------------------------------------------
 * Dois adapters, **um comportamento**: o que muda é o rótulo, o ícone e as
 * capacidades. Não é duplicação — é a mesma razão pela qual o backend tem dois
 * providers e um service: Pix e cartão são o mesmo provedor com duas
 * preferências, e tratá-los como duas implementações garantiria que
 * divergissem na terceira manutenção.
 *
 * **`fulfillment: "redirect"` é a decisão central deste arquivo.** É ela que diz
 * ao checkout "este meio sai daqui" — sem formulário na nossa página, sem
 * confirmação própria, e sem `placeOrder()`. Trocar para Checkout API é mudar
 * este valor e fornecer um `InlineUI`; o checkout não muda.
 *
 * **Por que há `ConfirmButton` e não o botão comum.** Porque o botão comum chama
 * `placeOrder()` — e completar o carrinho antes de o pagamento existir é
 * exatamente o que o provider recusa. Ver `payment-button.tsx` para o caminho
 * inteiro do porquê.
 *
 * **Zero `NEXT_PUBLIC_` de pagamento.** Não há chave nenhuma aqui: o
 * `init_point` chega na sessão de pagamento, montada pelo servidor. Qualquer
 * variável pública de pagamento seria um segredo de cobrança no bundle do
 * navegador — e o Mercado Pago não precisa de nenhuma.
 */
import { CreditCard } from "@medusajs/icons"
import {
  MERCADOPAGO_CARTAO_PROVIDER_ID,
  MERCADOPAGO_PIX_PROVIDER_ID,
} from "@rv/contrato/payment"

import type { PaymentAdapter } from "../../types"

import { criarBotaoDoMercadoPago } from "./payment-button"

/**
 * O `provider_id` é o **id do contrato**, e não o prefixo.
 *
 * ⚠️ Registrar um adapter com `MERCADOPAGO_PROVIDER_PREFIX` (`pp_mercadopago_`)
 * "funcionaria" e estaria errado: o `resolvePayment` casa por `startsWith`, e o
 * adapter de prefixo casaria com os dois meios — o que faz o **segundo** nunca
 * ser alcançado, porque a busca para no primeiro que casa. Seria um meio com o
 * ícone e o rótulo do outro, resolvido pela ordem de um array que ninguém lê.
 *
 * O teste de registro (`registry.spec.ts`) prende isto: os dois ids têm de
 * existir, ser distintos e cada um resolver para o seu adapter.
 */
const iconePix = null

export const mercadoPagoPixAdapter: PaymentAdapter = {
  id: MERCADOPAGO_PIX_PROVIDER_ID,
  label: "Pix",
  /**
   * Sem ícone: o `@medusajs/icons` não traz um de Pix, e um símbolo inventado
   * para o meio que mais se usa seria pior que a ausência — a lista de meios do
   * checkout já mostra o rótulo em texto. O dia em que houver um ícone oficial,
   * ele entra aqui e nada mais muda.
   */
  icon: iconePix,
  capabilities: {
    pix: true,
    cards: false,
    boleto: false,
    // Pix não parcela: é à vista por definição.
    interestFree: false,
  },
  fulfillment: "redirect",
  ConfirmButton: criarBotaoDoMercadoPago("Pagar com Pix"),
}

export const mercadoPagoCartaoAdapter: PaymentAdapter = {
  id: MERCADOPAGO_CARTAO_PROVIDER_ID,
  label: "Cartão de crédito",
  icon: <CreditCard />,
  capabilities: {
    pix: false,
    cards: true,
    boleto: false,
    // Até 12× — e o Mercado Pago **decide** o parcelamento sem juros por
    // bandeira e por produto. Declarar `true` sem contrato comercial com o
    // emissor seria prometer o que a loja não controla.
    interestFree: false,
  },
  fulfillment: "redirect",
  ConfirmButton: criarBotaoDoMercadoPago("Pagar com cartão"),
}
