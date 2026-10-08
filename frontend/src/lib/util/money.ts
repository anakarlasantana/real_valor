import { isEmpty } from "./isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

/**
 * O preço em dinheiro, no formato da loja.
 *
 * **`pt-BR` é o padrão, e isso é correção, não preferência.** O padrão era
 * `en-US`, herdado do starter do Medusa, e ele formata `R$ 249.90` — ponto
 * decimal numa loja brasileira, em **todo** lugar que mostra dinheiro: card,
 * página da peça, carrinho, totais, pedido e rastreio. Nenhum teste pegava,
 * porque nenhum teste olhava a string formatada.
 *
 * Quem precisar de outro formato passa `locale` — o parâmetro continua aqui.
 */
export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "pt-BR",
}: ConvertToLocaleParams) => {
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount)
    : amount.toString()
}
