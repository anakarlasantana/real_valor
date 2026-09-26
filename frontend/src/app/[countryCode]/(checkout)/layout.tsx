import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-rv-offwhite relative small:min-h-screen">
      <div className="h-20 bg-rv-offwhite border-b border-rv-border">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="rv-eyebrow text-rv-grafite flex items-center gap-x-2 flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block transition-colors duration-200 hover:text-rv-rose">
              Voltar para a sacola
            </span>
            <span className="mt-px block small:hidden transition-colors duration-200 hover:text-rv-rose">
              Voltar
            </span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="flex flex-col items-center leading-none"
            data-testid="store-link"
            aria-label="Real Valor — página inicial"
          >
            <span className="rv-display text-xl tracking-[0.3em] text-rv-preto small:text-2xl">
              REAL VALOR
            </span>
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
      <div className="py-8 w-full flex items-center justify-center">
        <span className="rv-eyebrow text-rv-muted">
          Compra segura · Real Valor
        </span>
      </div>
    </div>
  )
}
