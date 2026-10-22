"use server"

import { sdk } from "@lib/config"
import {
  classificarOpcoesDeEntrega,
  type EstadoDaEntrega,
} from "@lib/checkout/delivery-availability"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"

/**
 * O que o checkout recebe ao pedir as opções de entrega.
 *
 * O tipo obriga o `CheckoutForm` a tratar os três casos. Antes a função
 * devolvia `null` tanto para falha quanto para lista vazia, e o formulário
 * devolvia `null` para os dois — a página em branco. A regra da classificação
 * mora em `lib/checkout/delivery-availability.ts`, onde é testável sem I/O.
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

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("fulfillment")),
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
        next,
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((e) => {
      return null
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
