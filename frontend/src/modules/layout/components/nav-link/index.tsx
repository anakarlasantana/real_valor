"use client"

import { resolveIcon } from "@lib/content/icons"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, usePathname } from "next/navigation"
import { type MouseEvent, type ReactNode, useCallback } from "react"

/**
 * Link do menu do cabeçalho — o único lugar que sabe transformar um
 * `href` guardado no CMS no comportamento certo.
 *
 * O conteúdo guarda só duas strings (`label` + `href`); o tipo de
 * destino é deduzido da forma do `href`:
 *
 *   `#hero` / `/#hero`     rola até a seção de id `hero` da home
 *   `/store`, `/search`    página interna, com o país prefixado
 *   `https://…`            fora do site, em nova aba
 *   `mailto:…`, `tel:…`    cliente de e-mail / telefone
 *
 * Sobre a âncora: quando já estamos na home, o clique é interceptado e
 * rola suavemente (sem recarregar e sem empilhar histórico). De outra
 * rota, deixamos o navegador navegar — o alvo `id` existe na home e o
 * `scroll-margin-top` de `brand.css` compensa o cabeçalho fixo.
 */
export type NavLinkProps = {
  href: string
  /** Rótulo visível (texto/linha) e nome acessível (ícone). */
  label: string
  /**
   * `text` → só o rótulo (menu do desktop)
   * `icon` → só o ícone, 40px, com contador opcional (cluster da direita)
   * `row`  → ícone + rótulo (menu mobile, onde não há tooltip)
   */
  variant?: "text" | "icon" | "row"
  /** Chave de ícone; obrigatória nas variantes `icon` e `row`. */
  icon?: string
  /** Badge da variante `icon` (ex.: itens na sacola). */
  count?: number
  className?: string
  onClick?: () => void
  "data-testid"?: string
}

/** Protocolos que saem da loja e nunca levam o país. */
const EXTERNAL_PROTOCOL = /^(https?:|mailto:|tel:)/i

/** `#hero` e `/#hero` são a mesma âncora. */
const HOME_ANCHOR = /^\/?#(.+)$/

function anchorId(href: string): string | null {
  return HOME_ANCHOR.exec(href)?.[1] ?? null
}

const BASE_CLASSES: Record<NonNullable<NavLinkProps["variant"]>, string> = {
  text: "transition-colors hover:text-rv-rose",
  icon: "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-rv-grafite transition-colors hover:text-rv-rose focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rv-rose",
  row: "flex items-center gap-x-3 text-base text-rv-cacao transition-colors hover:text-rv-rose",
}

export default function NavLink({
  href,
  label,
  variant = "text",
  icon,
  count,
  className,
  onClick,
  "data-testid": dataTestId,
}: NavLinkProps) {
  const { countryCode } = useParams()
  const pathname = usePathname()

  const id = anchorId(href)

  const handleAnchorClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!id) {
        return
      }

      // Fora da home quem navega é o navegador (a página recarrega já no
      // fragmento). Aqui só tratamos o caso em que o alvo já está na tela.
      if (pathname !== `/${countryCode}`) {
        onClick?.()
        return
      }

      event.preventDefault()
      onClick?.()

      const target = document.getElementById(id)

      if (!target) {
        return
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches

      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      })

      // `replaceState` em vez de `pushState`: rolar não é navegação, e a
      // URL continua compartilhável.
      window.history.replaceState(null, "", `#${id}`)
    },
    [countryCode, id, onClick, pathname]
  )

  const classes = [BASE_CLASSES[variant], className].filter(Boolean).join(" ")

  // Nas variantes com ícone a chave pode chegar vazia (item recém-criado
  // no admin): o registro devolve o ícone padrão para o rótulo não vazar
  // para dentro de um botão de 40px. `text` não desenha ícone nenhum.
  const Icon = variant === "text" ? null : resolveIcon(icon ?? "")

  const content: ReactNode = !Icon ? (
    label
  ) : variant === "row" ? (
    <>
      <Icon
        className="h-4 w-4 shrink-0 text-rv-rose"
        aria-hidden="true"
        focusable="false"
      />
      <span>{label}</span>
    </>
  ) : (
    <>
      <Icon className="h-5 w-5" aria-hidden="true" focusable="false" />
      {typeof count === "number" && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rv-rose px-1 text-[10px] font-semibold leading-none text-rv-offwhite">
          {count}
        </span>
      )}
    </>
  )

  const common: {
    className: string
    onClick?: () => void
    "data-testid"?: string
    "aria-label"?: string
    title?: string
  } = {
    className: classes,
    onClick,
    "data-testid": dataTestId,
    // O ícone não tem texto visível: o nome acessível vem daqui e o
    // `title` atende o mouse.
    ...(variant === "icon"
      ? {
          "aria-label": count ? `${label} (${count})` : label,
          title: label,
        }
      : {}),
  }

  if (id) {
    return (
      <a
        {...common}
        href={`/${countryCode}/#${id}`}
        onClick={handleAnchorClick}
      >
        {content}
      </a>
    )
  }

  if (EXTERNAL_PROTOCOL.test(href)) {
    const leavesTheBrowser = /^https?:/i.test(href)

    return (
      <a
        {...common}
        href={href}
        {...(leavesTheBrowser
          ? { target: "_blank", rel: "noreferrer noopener" }
          : {})}
      >
        {content}
      </a>
    )
  }

  return (
    <LocalizedClientLink {...common} href={href}>
      {content}
    </LocalizedClientLink>
  )
}
