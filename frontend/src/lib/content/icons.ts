import {
  BadgeCheck,
  ChatBubbleLeftRight,
  Envelope,
  HandTruck,
  MagnifyingGlass,
  MapPin,
  Phone,
  ShoppingBag,
  Sparkles,
  Swatch,
  Tag,
  User,
} from "@medusajs/icons"

/**
 * Icon registry for content-driven sections.
 *
 * Content stores an icon as a plain string (so the admin UI can offer a
 * dropdown instead of shipping code), and this map turns it back into a
 * component. An unknown key falls back to `Sparkles` rather than
 * crashing — the same defensive rule `lib/theme.ts` uses for malformed
 * theme files.
 *
 * We deliberately use `@medusajs/icons` (already a dependency, and what
 * the rest of the storefront imports) instead of adding Lucide just for
 * a handful of glyphs.
 *
 * The type is derived from the icons themselves rather than hand-written:
 * they are `ForwardRefExoticComponent`s whose `IconProps` is not
 * re-exported from the package root, and a structural `SVGProps` alias
 * would not accept them.
 */
type IconComponent = typeof BadgeCheck

const ICONS: Record<string, IconComponent> = {
  // Faixa de benefícios ("benefits").
  quality: BadgeCheck,
  price: Tag,
  sizes: Swatch,
  delivery: HandTruck,
  // Ações do cabeçalho ("nav"). `bag` é especial: no cabeçalho ela vira
  // a sacola do carrinho, com contador.
  bag: ShoppingBag,
  account: User,
  search: MagnifyingGlass,
  whatsapp: ChatBubbleLeftRight,
  mail: Envelope,
  phone: Phone,
  pin: MapPin,
}

export const FALLBACK_ICON: IconComponent = Sparkles

export function resolveIcon(key: string): IconComponent {
  return ICONS[key] ?? FALLBACK_ICON
}

/** Keys offered by the admin UI, per section. Must match the union of
 *  `ICONS` above: the admin lists them by hand (it is a separate
 *  package and cannot import this file). */
export const AVAILABLE_ICON_KEYS = Object.keys(ICONS)

/** Keys offered for `BenefitsSection.items[].icon`. */
export const BENEFIT_ICON_KEYS = ["quality", "price", "sizes", "delivery"]

/** Keys offered for `NavSection.actions[].icon`. */
export const HEADER_ACTION_ICON_KEYS = [
  "bag",
  "account",
  "search",
  "whatsapp",
  "mail",
  "phone",
  "pin",
]
