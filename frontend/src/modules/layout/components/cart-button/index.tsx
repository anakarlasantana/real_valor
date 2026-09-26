import { retrieveCart } from "@lib/data/cart"
import CartDropdown from "../cart-dropdown"

/**
 * A sacola do cabeçalho — a única ação do menu com estado.
 *
 * Fica atrás de um `<Suspense>` no `Nav` para o carrinho (que é I/O) não
 * segurar a primeira pintura. Rótulo e destino vêm do conteúdo
 * (`NavSection.actions`), então o item continua editável no admin.
 */
export default async function CartButton({
  href,
  label,
}: {
  href: string
  label: string
}) {
  const cart = await retrieveCart().catch(() => null)

  return <CartDropdown cart={cart} href={href} label={label} />
}
