"use client"

/**
 * O botão que manda a cliente para o Mercado Pago.
 * -------------------------------------------------------------------------
 * **Por que este botão, e não o comum.** O checkout, para um meio que não traz
 * `ConfirmButton`, desenha o botão "Finalizar pedido" — que chama
 * `placeOrder()`, e `placeOrder()` completa o carrinho **no navegador**. No
 * Checkout Pro isso está errado por construção: quando a cliente clica em
 * "pagar", o dinheiro ainda **não** foi pago — ela nem viu a tela do Mercado
 * Pago. Completar o carrinho ali chamaria `authorizePayment` sem pagamento
 * nenhum, e o provider (corretamente) recusa: a cliente veria um erro em vez de
 * ser levada ao checkout.
 *
 * Então o botão deste meio não finaliza nada: ele **redireciona**. O pedido
 * nasce depois, no webhook, quando o dinheiro entrar de verdade.
 *
 * **De onde vem a URL.** Do `data` da **sessão de pagamento**, que o servidor
 * já criou quando a cliente escolheu o meio (`initiatePaymentSession` →
 * `POST /checkout/preferences` → `init_point`). Não há chamada nova no clique:
 * a preferência já existe, e o clique é só uma navegação. Isso é o que faz o
 * botão ser instantâneo, e o que evita cobrar uma preferência por clique.
 *
 * **Por que não há `onPaymentCompleted`.** Porque não há o que completar do lado
 * de cá. Não é omissão: é a diferença entre um meio `redirect` e um `inline`, e
 * é a mesma diferença que o `fulfillment` do adapter declara.
 */
import { Button, toast } from "@medusajs/ui"
import { useState } from "react"

import { MERCADOPAGO_PROVIDER_PREFIX } from "@rv/contrato/payment"

import type { ConfirmButtonProps } from "../../types"

/** A mensagem de uma preferência que não foi criada. */
const SEM_DESTINO =
  "Não conseguimos abrir o checkout do Mercado Pago. Recarregue a página e tente de novo."

/**
 * Monta um botão para um meio, com o rótulo dele.
 *
 * A fábrica existe porque os dois meios têm o **mesmo comportamento** e rótulos
 * diferentes — e porque a alternativa (um `if` dentro do botão para decidir o
 * texto) é o acoplamento que o registry existe para desfazer. Dois adapters,
 * dois componentes, um comportamento: o comportamento fica num lugar, a
 * identidade fica em dois.
 */
export function criarBotaoDoMercadoPago(rotulo: string) {
  return function BotaoDoMercadoPago({
    notReady,
    cart,
    "data-testid": dataTestId,
  }: ConfirmButtonProps) {
    const [indo, setIndo] = useState(false)

    /**
     * O destino, lido da sessão **deste** meio.
     *
     * O `find` pelo prefixo e não `[0]`: o carrinho pode ter sessões de outros
     * provedores (o `pp_system_default` convive com os nossos), e pegar a
     * primeira pegaria a errada. É a mesma razão pela qual o `provider_id` é a
     * chave do registry.
     */
    const destino = cart.payment_collection?.payment_sessions?.find((sessao) =>
      sessao.provider_id?.startsWith(MERCADOPAGO_PROVIDER_PREFIX)
    )?.data?.init_point as string | undefined

    const ir = () => {
      if (!destino) {
        toast.error(SEM_DESTINO)
        return
      }

      setIndo(true)

      // `location.assign` e não `router.push`: é uma saída do nosso domínio.
      // O `router` do Next trata como navegação interna e tentaria buscar a
      // página — que não está aqui e nunca vai estar.
      window.location.assign(destino)
    }

    return (
      <Button
        disabled={notReady || !destino}
        isLoading={indo}
        onClick={ir}
        size="large"
        data-testid={dataTestId}
      >
        {rotulo}
      </Button>
    )
  }
}
