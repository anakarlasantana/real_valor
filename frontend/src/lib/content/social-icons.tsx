import React from "react"

import { IconProps } from "types/icon"

/**
 * Social icon registry for the footer.
 *
 * Content stores an icon as a plain string (so the admin can offer a
 * dropdown instead of shipping code) and this file turns it back into a
 * component — the same trick `lib/content/icons.ts` plays for benefits
 * and header actions.
 *
 * It lives apart from `icons.ts` on purpose: that registry is built on
 * `@medusajs/icons`, which ships no Instagram/WhatsApp/YouTube glyph.
 * These are drawn here as line art, with `stroke`/`fill` bound to
 * `color` so they inherit the footer's colour and hover state.
 *
 * The keys the admin offers are listed by hand in
 * `backend/src/admin/routes/content/field-input.tsx` (`list:social`) —
 * `scripts/check-contract-parity.mjs` fails when the two lists drift, or
 * when the keys below do not match this map.
 */

const Instagram: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.5" />
      <circle cx="17.1" cy="6.9" r="1" fill={color} />
    </svg>
  )
}

const Facebook: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 8.2h-1.4c-1 0-1.8.8-1.8 1.8v9"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 12.4h5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const WhatsApp: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      {/* Balão com a ponta no canto inferior esquerdo. */}
      <path
        d="M20 11.5a8 8 0 0 1-11.8 7.2L4 20l1.3-4.2A8 8 0 1 1 20 11.5Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Aparelho dentro do balão: o `scale` encaixa o desenho de 24 no
          diâmetro de 16 do balão, e o `strokeWidth` compensa a redução. */}
      <g transform="translate(6.2 5.6) scale(0.48)">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

const YouTube: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="13"
        rx="4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 9.4 15 12l-4.6 2.6z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Reserva para chave desconhecida ou vazia (item recém-criado no admin,
 *  que nasce sem ícone): um globo lê como "site" e nunca deixa um buraco
 *  na fileira. Fica de fora do mapa — como `FALLBACK_ICON` em `icons.ts`. */
const Globe: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 12h17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Keys offered by the admin UI, per type. Must match the union of
 *  `SOCIAL_ICONS` below: the admin lists them by hand (it is a separate
 *  package and cannot import this file). */
export const SOCIAL_ICON_KEYS = ["instagram", "facebook", "whatsapp", "youtube"]

export const SOCIAL_ICONS: Record<string, React.FC<IconProps>> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: WhatsApp,
  youtube: YouTube,
}

export const FALLBACK_SOCIAL_ICON: React.FC<IconProps> = Globe

export function resolveSocialIcon(key: string): React.FC<IconProps> {
  return SOCIAL_ICONS[key] ?? FALLBACK_SOCIAL_ICON
}
