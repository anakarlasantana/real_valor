"use server"

import { sdk } from "@lib/config"
import {
  classificarOpcoesDeEntrega,
  type EstadoDaEntrega,
} from "@lib/checkout/delivery-availability"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"

/**
 * O que o checkout recebe ao pedir as opções de entrega, nos três casos.
 */
export type OpcoesDeEntrega =
  EstadoDaEntrega<HttpTypes.StoreCartShippingOptionWithServiceZone>

export const listCartShippingMethods = async (
  cartId: string
): Promise<OpcoesDeEntrega> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        // `no-store` é deliberado: a resposta depende do carrinho e do
        // endereço, e uma falha passageira (SuperFrete fora do ar) não pode
        // ficar gravada no cache do Next — seria o checkout indisponível
        // continuando indisponível depois que a transportadora voltasse.
        cache: "no-store",
      }
    )
    .then(({ shipping_options }) =>
      classificarOpcoesDeEntrega(shipping_options)
    )
    .catch(() => ({ estado: "indisponivel" as const }))
}

/**
 * A cotacao do frete: preco quando deu certo, motivo quando nao.
 *
 * O erro **nao** e lancado: esta e' uma Server Action, e excecao atravessando a
 * fronteira vira 500 na pagina inteira (medido no `step=delivery`).
 */
export type CotacaoDaOpcao =
  | { ok: true; opcao: HttpTypes.StoreCartShippingOption }
  | { ok: false; motivo: string; status: number }

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
): Promise<CotacaoDaOpcao> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const body = { cart_id: cartId, data }

  if (data) {
    body.data = data
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        // Dado por sessao: cachear trocaria o preco de um visitante no outro.
        cache: "no-store",
      }
    )
    .then(({ shipping_option }): CotacaoDaOpcao => ({ ok: true, opcao: shipping_option }))
    .catch((erro: unknown): CotacaoDaOpcao => {
      const causa = erro as { status?: number; message?: string }
      const mensagem = String(causa?.message ?? "").trim()

      return {
        ok: false,
        motivo: mensagem || "O cálculo do frete não respondeu. Tente novamente.",
        status: Number(causa?.status) || 502,
      }
    })
}

/** Uma cotação dos Correios: o serviço, o preço em reais e o prazo em dias úteis. */
export type CotacaoDeFrete = {
  servico: "PAC" | "SEDEX" | "MINI"
  nome: string
  preco: number
  prazo: number
}

/** Preço e prazo. A rota responde em centavos; `preco` sai em reais. */
export const cotarFrete = async (
  cartId: string
): Promise<CotacaoDeFrete[] | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ cotacoes: CotacaoDeFrete[] }>("/store/shipping/quote", {
      method: "GET",
      query: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    .then(({ cotacoes }) =>
      (cotacoes ?? []).map((cotacao) => ({
        ...cotacao,
        preco: cotacao.preco / 100,
      }))
    )
    .catch(() => null)
}
