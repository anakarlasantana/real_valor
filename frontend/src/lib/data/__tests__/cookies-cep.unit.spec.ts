import { beforeEach, describe, expect, it, vi } from "vitest"

const { store, setMock } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  setMock: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      store.has(nome) ? { value: store.get(nome) } : undefined,
    set: (nome: string, valor: string, opcoes: unknown) => {
      store.set(nome, valor)
      setMock(nome, valor, opcoes)
    },
  }),
}))

import { CEP_COOKIE, getCepHerdado, setCepHerdado } from "../cookies"

beforeEach(() => {
  store.clear()
  setMock.mockClear()
})

describe("o CEP herdado do checkout", () => {
  it("grava só os dígitos e ignora o que não é CEP completo", async () => {
    await setCepHerdado("01310-100")
    expect(store.get(CEP_COOKIE)).toBe("01310100")

    await setCepHerdado("0131")
    expect(store.get(CEP_COOKIE)).toBe("01310100")
  })

  it("lê o que foi gravado, também só com dígitos", async () => {
    store.set(CEP_COOKIE, "60352-680")

    await expect(getCepHerdado()).resolves.toBe("60352680")
  })

  it("sem cookie, devolve vazio em vez de quebrar", async () => {
    await expect(getCepHerdado()).resolves.toBe("")
  })

  it("o cookie vale 30 dias na raiz do site", async () => {
    await setCepHerdado("01310100")

    expect(setMock).toHaveBeenCalledWith(
      CEP_COOKIE,
      "01310100",
      expect.objectContaining({
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      })
    )
  })
})
