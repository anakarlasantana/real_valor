/**
 * O parcelamento e o Pix, **em uma linha**.
 * -------------------------------------------------------------------------
 * O redesenho escreve, ao lado do preço:
 *
 *   6x de R$ 124,90 sem juros
 *   R$ 464,55 no Pix
 *
 * O que este módulo faz é **escrever o que o provedor respondeu** — e nada mais.
 * `InstallmentInfo` (o contrato, em `@rv/contrato/payment`) é o que o meio de
 * pagamento sabe sobre um valor: quantas parcelas, quanto cada uma e se tem juros.
 * O Medusa não tem esse dado, e por isso não há nada para calcular aqui: um "6x sem
 * juros" inventado seria condição de pagamento que a loja pode não ter, escrita
 * logo abaixo do preço — o pior lugar possível para uma promessa.
 *
 * **A unidade é a do contrato: centavos.** `InstallmentInfo.amount` é o valor de
 * cada parcela **em centavos**, e é aqui — em um lugar só — que ele vira dinheiro
 * formatado (`convertToLocale`, o `pt-BR` da casa). O resto do storefront trabalha
 * em reais (o `calculated_amount` da Store API): um `× 100` esquecido em algum
 * chamador é a parcela de R$ 12.490,00, e é por isso que a conversão está
 * declarada no nome do parâmetro e coberta por teste.
 *
 * O valor do Pix, ao contrário, chega **em reais** — é o preço da tela com o
 * desconto que a loja decidir, e a decisão do desconto não é deste módulo (ver o
 * comentário de `InstallmentInfo`, o componente).
 */
import type { InstallmentInfo } from "@rv/contrato/payment"

import { convertToLocale } from "./money"

/**
 * "6x de R$ 124,90 sem juros".
 *
 * `null` quando não há parcelamento a mostrar, e as recusas são de dado real:
 *
 *   - `count` menor que 2: uma parcela não é parcelamento ("1x de R$ 249,90" é o
 *     preço, escrito duas vezes);
 *   - `amount` zerado ou não numérico: sem valor de parcela não há o que dizer;
 *   - moeda ausente: `convertToLocale` devolve o número cru quando não há moeda, e
 *     "6x de 12490" na tela é pior do que a linha não existir.
 *
 * `interestFree` é o que a referência escreve ("sem juros"), e ele só vem do
 * provedor. Quando não é sem juros, a linha diz "com juros" — o número sozinho
 * faria a cliente descobrir a taxa no fim do checkout.
 */
export function linhaDasParcelas(
  info: InstallmentInfo | null | undefined,
  moeda: string | null | undefined
): string | null {
  if (!info || !moeda) {
    return null
  }

  const { count, amount, interestFree } = info

  if (!Number.isInteger(count) || count < 2) {
    return null
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const valor = convertToLocale({
    amount: amount / 100,
    currency_code: moeda,
  })

  return `${count}x de ${valor} ${interestFree ? "sem juros" : "com juros"}`
}

/**
 * "R$ 464,55 no Pix" — a outra condição de pagamento do mesmo valor.
 *
 * `valor` chega **em reais**, como o preço da tela. Zero é um valor legítimo (a
 * peça de brinde que a loja vende de verdade), e por isso a guarda é de número
 * finito, não de verdadeiro — só moeda ausente derruba a linha.
 */
export function linhaDoPix(
  valor: number | null | undefined,
  moeda: string | null | undefined
): string | null {
  if (valor === null || valor === undefined || !moeda) {
    return null
  }

  if (!Number.isFinite(valor) || valor < 0) {
    return null
  }

  return `${convertToLocale({ amount: valor, currency_code: moeda })} no Pix`
}
