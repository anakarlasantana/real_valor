import { User } from "@medusajs/icons"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * O convite para entrar na conta, acima da lista da sacola.
 *
 * O texto estava em inglês ("Already have an account?" / "Sign in for a better
 * experience.") e o botão era o do design system. A promessa, aqui, é
 * concreta — endereço e cartão guardados, e o pedido ligado à conta —, e é isso
 * que a frase diz agora.
 */
const SignInPrompt = () => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-rv-border bg-rv-surface p-5">
      <div className="flex items-center gap-3">
        <User
          className="shrink-0 text-rv-rose"
          aria-hidden="true"
          focusable="false"
        />
        <div>
          <p className="rv-eyebrow text-rv-preto">Já tem conta?</p>
          <p className="mt-1 text-xs text-rv-muted">
            Entre e a gente preenche o endereço e o cartão por você.
          </p>
        </div>
      </div>

      <LocalizedClientLink
        href="/account"
        className="rv-btn rv-btn-secondary"
        data-testid="sign-in-button"
      >
        Entrar
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
