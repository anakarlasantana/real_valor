import { Metadata } from "next"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getHomeSections } from "@lib/data/content"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import { announceSections, headerSections } from "@lib/content/home-sections"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import AnnouncementBar from "@modules/home/components/announcement-bar"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const [customer, cart, sections] = await Promise.all([
    retrieveCustomer(),
    retrieveCart(),
    // O anúncio é conteúdo, então vem do módulo Content como as demais
    // seções — mas é renderizado aqui, e não na home, porque aparece em
    // todas as rotas da loja.
    getHomeSections().catch((error) => {
      console.error("Falha ao carregar o conteúdo do layout:", error)
      return []
    }),
  ])

  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()

    shippingOptions = shipping_options
  }

  // O cabeçalho também é cromo (toda rota), mas seus links são conteúdo:
  // saem do mesmo payload que o anúncio, com fallback embutido.
  const header = headerSections(sections)

  return (
    <>
      <AnnouncementBar
        text={announceSections(sections)?.text ?? "Frete seguro para todo o Brasil"}
      />
      <Nav header={header} />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      {props.children}
      <Footer />
    </>
  )
}
