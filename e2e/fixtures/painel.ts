/**
 * A credencial do painel — uma fonte só.
 *
 * A senha do login **não** é o `ADMIN_PASSWORD` do `.env`: esse valor só cria o
 * primeiro usuário, e o Medusa trata "já existe" como sucesso, então editar o
 * `.env` não muda login nenhum (`Makefile:313-316`, `scripts/senha-admin.sh`).
 * O que vale é o que `make admin-password` gravou.
 *
 * Por isso a jornada não traz literal: o valor entra por processo, vindo do
 * `.env` que o `scripts/e2e-stack.sh` exporta. Sem ele, o erro é explícito —
 * antes, o spec caía numa senha fixa (`admin123456`), o login respondia
 * `unauthorized` e o teste morria num timeout de 90s esperando o menu.
 */
export function credencialPainel(): { email: string; senha: string } {
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@realvalor.com.br"
  const senha = process.env.E2E_ADMIN_PASSWORD

  if (!senha) {
    throw new Error(
      "E2E_ADMIN_PASSWORD ausente: a senha do painel é a que está no `.env` " +
        "(gerada por `make admin-password`). O spec não adivinha credencial — " +
        "suba a stack com `make e2e-up`, que exporta a variável."
    )
  }

  return { email, senha }
}
