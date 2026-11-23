"use server"

import { FALHA_NA_COTACAO, SEM_OPCAO } from "@lib/checkout/cep-frete"
import { descreverPrazo, type OpcaoDeEntrega } from "@lib/checkout/shipping-quote"
import { sdk } from "@lib/config"
import { getAuthHeaders, setCepHerdado } from "@lib/data/cookies"

type CotacaoCrua = {
  servico?: string
  nome?: string
  preco?: number
  prazo?: number
}

export type ResultadoDaCotacao =
  | { ok: true; opcoes: OpcaoDeEntrega[] }
  | { ok: false; mensagem: string }

export async function cotarNaPeca({
  cep,
  variantId,
  quantidade = 1,
}: {
  cep: string
  variantId: string
  quantidade?: number
}): Promise<ResultadoDaCotacao> {
  const headers = { ...(await getAuthHeaders()) }

  try {
    const { cotacoes } = await sdk.client.fetch<{ cotacoes: CotacaoCrua[] }>(
      "/store/shipping/quote/preview",
      {
        method: "GET",
        query: { postal_code: cep, variant_id: variantId, quantity: quantidade },
        headers,
        cache: "no-store",
      }
    )

    const opcoes = (cotacoes ?? [])
      .map((cotacao) => ({
        titulo: String(cotacao?.nome ?? cotacao?.servico ?? "").trim(),
        prazo: descreverPrazo(Number(cotacao?.prazo)),
        preco: Number(cotacao?.preco) / 100,
        moeda: "brl",
      }))
      .filter((opcao) => opcao.titulo !== "")

    if (opcoes.length === 0) {
      return { ok: false, mensagem: SEM_OPCAO }
    }

    await setCepHerdado(cep)

    return { ok: true, opcoes }
  } catch {
    return { ok: false, mensagem: FALHA_NA_COTACAO }
  }
}
