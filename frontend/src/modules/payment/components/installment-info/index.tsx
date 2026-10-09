import type { InstallmentInfo as InstallmentInfoDoProvedor } from "@rv/contrato/payment"

import { linhaDasParcelas, linhaDoPix } from "@lib/util/installments"

/**
 * O parcelamento e a linha do Pix — as duas condições de pagamento do mesmo
 * valor, escritas abaixo do preço.
 *
 *   **6x de R$ 124,90 sem juros**
 *   **R$ 464,55 no Pix**
 *
 * Ele é **puro**: não consulta nada, não decide preço e não conhece provedor. O
 * que chega são dois números já respondidos — o `InstallmentInfo` do meio de
 * pagamento (contrato `@rv/contrato/payment`) e o valor do Pix —, e quem os
 * escreve é `lib/util/installments.ts`, com teste. A regra de exibição inteira
 * mora lá; aqui só se decide desenhar ou não.
 *
 * **Os dois valores ainda não existem, e é por isso que este bloco nasce
 * desligado.** O Medusa não tem parcelamento: quem sabe é o meio de pagamento, no
 * checkout, pelo `describe(amount)` do adapter. E o **valor do Pix é uma regra de
 * desconto que a loja ainda não cadastrou** — o checkout anuncia 5% e o adapter do
 * Mercado Pago não aplica desconto nenhum hoje, então qualquer número escrito aqui
 * seria a loja prometendo um preço que o checkout não vai cobrar. Quando as duas
 * pontas existirem, elas passam os valores e o bloco acende: a montagem já está
 * feita, no bloco do preço da peça e no resumo da sacola.
 *
 * Sem um dos dois, o outro continua aparecendo; sem nenhum, ele devolve `null`.
 */
export default function InstallmentInfo({
  installments,
  pix,
  moeda,
}: {
  /** O parcelamento que o provedor respondeu. `InstallmentInfo`, em centavos. */
  installments?: InstallmentInfoDoProvedor | null
  /** O valor no Pix, **em reais** — o preço da tela com o desconto da loja. */
  pix?: number | null
  /** A moeda dos dois valores (`brl`). Sem ela, não há linha — nem preço. */
  moeda?: string | null
}) {
  const parcelas = linhaDasParcelas(installments, moeda)
  const noPix = linhaDoPix(pix, moeda)

  if (!parcelas && !noPix) {
    return null
  }

  return (
    <div className="rv-installments" data-testid="installment-info">
      {parcelas && <span>{parcelas}</span>}

      {/* O Pix é o `<b>` da referência, e o verde dele é do CSS: é a outra
          condição do mesmo valor, e a que a loja quer que a cliente leia. */}
      {noPix && <b>{noPix}</b>}
    </div>
  )
}
