import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import ShippingQuote from ".."

const html = () => renderToStaticMarkup(<ShippingQuote variantId="variant_1" />)

describe("ShippingQuote", () => {
  it("desenha o campo de CEP e o botão antes de qualquer consulta", () => {
    const markup = html()

    expect(markup).toContain('data-testid="shipping-quote"')
    expect(markup).toContain("Frete e prazo")
    expect(markup).toContain('data-testid="cep-frete-input"')
    expect(markup).toContain('data-testid="cep-frete-calcular"')
    expect(markup).toContain("Calcular")
  })

  it("não desenha resultado nem aviso sem consulta", () => {
    const markup = html()

    expect(markup).not.toContain('data-testid="cep-frete-opcoes"')
    expect(markup).not.toContain('data-testid="cep-frete-aviso"')
  })
})
