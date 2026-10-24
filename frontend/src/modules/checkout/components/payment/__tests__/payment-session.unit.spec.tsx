// @vitest-environment jsdom
// Recusa do provedor no passo 3 (22/10/2026): o 400 derrubava o render; aqui vira
// texto. Os meios do MP são `redirect` — a sessão nasce no "Continuar".
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

const initiatePaymentSession = vi.fn()

vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: (...args: unknown[]) =>
    initiatePaymentSession(...args),
}))

const searchParams = new URLSearchParams("step=payment")

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  usePathname: () => "/br/checkout",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import Payment from ".."

/** Um carrinho com frete e documento: só falta o meio de pagamento. */
const carrinho = {
  id: "cart_01M5G9QFTBYF1EGTWR71NSYKED",
  total: 141.4,
  metadata: { cpf: "06618943396", tipo_documento: "CPF" },
  shipping_methods: [{ id: "casm_01M5QQF6XXJKQ16S0WZ2MFYG0T" }],
  payment_collection: { payment_sessions: [] },
} as any

const meios = [
  { id: "pp_mercadopago_pix" },
  { id: "pp_mercadopago_cartao" },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("o passo 3 quando o provedor recusa a sessão", () => {
  /** Escolhe o Pix (o primeiro da lista) e aperta Continuar. */
  const escolherPixEContinuar = async () => {
    const user = userEvent.setup()

    render(<Payment cart={carrinho} availablePaymentMethods={meios} />)

    await user.click(screen.getByText("Pix"))
    await user.click(screen.getByTestId("submit-payment-button"))

    return user
  }

  it("mostra a mensagem do backend e não derruba o render", async () => {
    initiatePaymentSession.mockRejectedValue(
      new Error("account_money cannot be excluded. O Mercado Pago recusou os dados.")
    )

    await escolherPixEContinuar()

    await waitFor(() =>
      expect(initiatePaymentSession).toHaveBeenCalledWith(carrinho, {
        provider_id: "pp_mercadopago_pix",
      })
    )

    // A recusa aparece no passo, com o componente ainda montado.
    expect(
      await screen.findByTestId("payment-method-error-message")
    ).toHaveTextContent(
      "account_money cannot be excluded. O Mercado Pago recusou os dados."
    )

    expect(screen.getByTestId("submit-payment-button")).toBeInTheDocument()
  })

  it("não deixa a mensagem vazia quando o erro chega sem texto", async () => {
    // O Next troca a mensagem por um digest na borda: chega `""`.
    initiatePaymentSession.mockRejectedValue(new Error(""))

    await escolherPixEContinuar()

    expect(
      await screen.findByTestId("payment-method-error-message")
    ).toHaveTextContent("Não foi possível iniciar o pagamento agora")
  })
})
