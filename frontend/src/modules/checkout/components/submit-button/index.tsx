"use client"

import { clx } from "@medusajs/ui"
import React from "react"
import { useFormStatus } from "react-dom"

/**
 * O botão que envia o formulário de um passo.
 *
 * Ele era o `Button` do `@medusajs/ui` — o azul da Medusa, com o spinner e as
 * medidas do design system. Agora é o `.rv-btn` da casa, e o que ele acrescenta
 * por cima é só o estado de envio: `useFormStatus` é o hook do próprio React para
 * isso, e é ele que diz "o formulário está no ar" sem que o componente precise de
 * estado próprio.
 *
 * O rótulo muda para "Enviando…" durante o envio. Antes disso o botão só girava um
 * spinner: quem usa leitor de tela ouvia o rótulo antigo ("Continuar para a
 * entrega") enquanto a página não respondia, e a mudança de texto é o que
 * transforma isso em "a loja está trabalhando".
 */
const VARIANT_CLASS: Record<string, string> = {
  primary: "rv-btn-primary",
  secondary: "rv-btn-secondary",
  transparent: "rv-btn-ghost",
  // Não há variante de perigo no `brand.css`: a única ação destrutiva do checkout
  // é remover o cupom, e ela é um botão de texto, não um botão cheio de vermelho.
  danger: "rv-btn-primary",
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "transparent" | "danger" | null
  className?: string
  "data-testid"?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className={clx(
        "rv-btn",
        VARIANT_CLASS[variant || "primary"] ?? "rv-btn-primary",
        className
      )}
      disabled={pending}
      aria-busy={pending}
      data-testid={dataTestId}
    >
      {pending ? "Enviando…" : children}
    </button>
  )
}

