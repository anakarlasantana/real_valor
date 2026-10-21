// @vitest-environment jsdom
/**
 * O CEP, com eventos de verdade. `renderToStaticMarkup` não anexa handler, então
 * um checkout de build antigo, sem `onBlur`, passava verde. Ver RV-040.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import ShippingAddress from ".."

/** A resposta do proxy /api/cep para a Avenida Paulista. */
const PAULISTA = {
  encontrado: true,
  endereco: {
    logradouro: "Avenida Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
  },
}

/** Um carrinho mínimo: o componente só lê o endereço e o e-mail dele. */
const carrinho = {
  email: "cliente@exemplo.com",
  shipping_address: null,
  metadata: null,
  region: { countries: [{ iso_2: "br" }] },
} as any

const renderizar = () =>
  render(
    <ShippingAddress
      customer={null}
      cart={carrinho}
      checked
      onChange={() => {}}
    />
  )

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => PAULISTA,
  }))

  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("CEP no endereço de entrega", () => {
  it("busca ao completar os oito dígitos, sem precisar sair do campo", async () => {
    const user = userEvent.setup()

    renderizar()

    await user.type(
      screen.getByTestId("shipping-postal-code-input"),
      "01310100"
    )

    // A requisição sai pelo `onChange`, no oitavo dígito: o gatilho do `blur`
    // existe, mas não é o único — autofill e Enter não passam por ele.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // No navegador a busca passa pelo proxy da mesma origem (evita CORS do ViaCEP).
    expect(fetchMock.mock.calls[0][0]).toBe("/api/cep/01310100")
  })

  it("preenche rua, cidade e UF com o que o provedor devolveu", async () => {
    const user = userEvent.setup()

    renderizar()

    const campoCep = screen.getByTestId("shipping-postal-code-input")

    await user.type(campoCep, "01310100")
    await user.tab() // o `blur`: o mesmo CEP não refaz o pedido

    await waitFor(() =>
      expect(
        (screen.getByTestId("shipping-address-input") as HTMLInputElement).value
      ).toBe("Avenida Paulista")
    )

    expect(
      (screen.getByTestId("shipping-city-input") as HTMLInputElement).value
    ).toBe("São Paulo")
    expect(
      (screen.getByTestId("shipping-province-input") as HTMLInputElement).value
    ).toBe("SP")

    // `onChange` no 8º dígito + `blur` não podem virar duas requisições.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("avisa na tela quando o CEP não existe", async () => {
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ encontrado: false, motivo: "cep-inexistente" }),
        }) as any
    )

    const user = userEvent.setup()

    renderizar()

    await user.type(
      screen.getByTestId("shipping-postal-code-input"),
      "99999999"
    )

    expect(await screen.findByTestId("shipping-cep-erro")).toHaveTextContent(
      "CEP não encontrado"
    )
  })

  it("avisa na tela quando nenhum provedor respondeu", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch")
    })

    const user = userEvent.setup()

    renderizar()

    await user.type(
      screen.getByTestId("shipping-postal-code-input"),
      "01310100"
    )

    expect(await screen.findByTestId("shipping-cep-erro")).toHaveTextContent(
      "Não foi possível buscar o CEP"
    )
  })
})
