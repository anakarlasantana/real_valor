"use server"

import { sdk } from "@lib/config"
import { meiosDePagamentoVisiveis } from "@lib/payments/providers"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("payment_providers")),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: "force-cache",
      }
    )
    // O `pp_system_default` do Medusa é filtrado aqui, e não no componente:
    // é a fronteira entre "o que o backend registrou" e "o que a loja
    // oferece". Ver `lib/payments/providers.ts` para o motivo de o filtro ser
    // incondicional. Uma lista vazia é um estado legítimo — o checkout mostra
    // "pagamento indisponível" em vez de sumir.
    .then(({ payment_providers }) =>
      meiosDePagamentoVisiveis(payment_providers)
    )
    .catch(() => {
      return null
    })
}
