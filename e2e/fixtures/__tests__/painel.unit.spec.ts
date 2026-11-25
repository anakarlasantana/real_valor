import { afterEach, describe, expect, it } from "@jest/globals"

import { credencialPainel } from "../painel"

/**
 * O contrato da credencial do painel (RV-076 CA-2 e CA-4).
 *
 * O que se prova aqui é o modo de falha: sem a variável, o helper **nomeia** o
 * que falta em vez de devolver uma senha inventada. Era o defeito original —
 * `admin123456` levava a `unauthorized` e o teste morria num timeout de 90s.
 */
describe("credencialPainel", () => {
  const original = process.env.E2E_ADMIN_PASSWORD

  afterEach(() => {
    if (original === undefined) delete process.env.E2E_ADMIN_PASSWORD
    else process.env.E2E_ADMIN_PASSWORD = original
  })

  it("devolve a senha do processo e o e-mail padrão", () => {
    process.env.E2E_ADMIN_PASSWORD = "senha-da-stack"

    expect(credencialPainel()).toEqual({
      email: "admin@realvalor.com.br",
      senha: "senha-da-stack",
    })
  })

  it("respeita o e-mail da variável quando definido", () => {
    process.env.E2E_ADMIN_PASSWORD = "senha-da-stack"
    process.env.E2E_ADMIN_EMAIL = "lojista@realvalor.test"

    try {
      expect(credencialPainel().email).toBe("lojista@realvalor.test")
    } finally {
      delete process.env.E2E_ADMIN_EMAIL
    }
  })

  it("sem a variável, falha nomeando E2E_ADMIN_PASSWORD", () => {
    delete process.env.E2E_ADMIN_PASSWORD

    expect(() => credencialPainel()).toThrow(/E2E_ADMIN_PASSWORD ausente/)
  })

  it("a senha não é literal no spec: o mesmo valor vem do processo", () => {
    process.env.E2E_ADMIN_PASSWORD = "outra-senha"
    const primeira = credencialPainel().senha
    process.env.E2E_ADMIN_PASSWORD = "mudou"
    const segunda = credencialPainel().senha

    expect(primeira).toBe("outra-senha")
    expect(segunda).toBe("mudou")
    expect(segunda).not.toBe(primeira)
  })
})
