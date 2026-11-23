import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ler = (...partes: string[]) =>
  readFileSync(join(__dirname, ...partes), "utf8")

function semBloco(codigo: string): string {
  let saida = ""
  let resto = codigo

  for (;;) {
    const abre = resto.indexOf("/*")

    if (abre < 0) {
      return saida + resto
    }

    saida += resto.slice(0, abre)

    const fecha = resto.indexOf("*/", abre)

    if (fecha < 0) {
      return saida
    }

    resto = resto.slice(fecha + 2)
  }
}

const semComentarios = (codigo: string) =>
  semBloco(codigo)
    .split("\n")
    .map((linha) => (linha.trim().startsWith("//") ? "" : linha))
    .join("\n")

const PAYMENT = semComentarios(
  ler("..", "modules", "checkout", "components", "payment", "index.tsx")
)

const PAYMENT_BUTTON = semComentarios(
  ler("..", "modules", "checkout", "components", "payment-button", "index.tsx")
)

const PROIBIDOS = [
  "isStripeLike",
  "isPaypal",
  "isManual",
  "stripe",
  "paypal",
  "mercadopago",
  "pp_",
]

describe("o checkout não pergunta qual é o provedor", () => {
  it("payment/index.tsx resolve pelo registry, e nada mais", () => {
    expect(PAYMENT).toContain("resolvePayment(")

    for (const proibido of PROIBIDOS) {
      expect(PAYMENT.toLowerCase()).not.toContain(proibido.toLowerCase())
    }
  })

  it("payment-button/index.tsx também não conhece provedor", () => {
    for (const proibido of PROIBIDOS) {
      expect(PAYMENT_BUTTON.toLowerCase()).not.toContain(proibido.toLowerCase())
    }
  })
})
