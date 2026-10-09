import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import { HttpTypes } from "@medusajs/types"

/**
 * A sacola — o cabeçalho de página, a lista de itens e o resumo.
 *
 * Três mudanças em relação ao que estava, todas visíveis:
 *
 *   1. **O cabeçalho é da loja.** Era um título "Cart" dentro da lista de itens;
 *      agora é o cabeçalho de página do redesenho — "Sacola (n item)", centrado,
 *      com a contagem em corpo menor ao lado do título.
 *   2. **A lista e o resumo dividem a largura** (1,5 para 0,8) em vez de duas
 *      colunas com 10rem de respiro entre elas.
 *   3. **O convite para entrar na conta ficou acima da lista**, discreto, e não
 *      como o bloco branco que abria a página — ele é útil (endereço e cartão
 *      guardados), mas não é o assunto da tela.
 *
 * Sem faixa de abertura aqui: a página da sacola é um documento, e o título dela
 * não precisa de fundo elevado para ser lido.
 */
const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const total = cart?.items?.reduce((soma, item) => soma + item.quantity, 0) ?? 0

  return (
    <main className="rv-page-shell" data-testid="cart-container">
      <div className="rv-page-heading-block">
        <span className="rv-eyebrow text-rv-rose-strong">Sua seleção</span>
        <h1>
          Sacola{" "}
          <em>
            ({total} {total === 1 ? "item" : "itens"})
          </em>
        </h1>
      </div>

      {cart?.items?.length ? (
        <div className="rv-cart-layout">
          <div>
            {!customer && (
              <div className="mb-8">
                <SignInPrompt />
              </div>
            )}
            <ItemsTemplate cart={cart} />
          </div>

          <div>{cart && cart.region && <Summary cart={cart as any} />}</div>
        </div>
      ) : (
        <EmptyCartMessage />
      )}
    </main>
  )
}

export default CartTemplate
