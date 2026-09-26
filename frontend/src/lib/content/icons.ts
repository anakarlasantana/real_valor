import { BadgeCheck, HandTruck, Sparkles, Swatch, Tag } from "@medusajs/icons"

/**
 * Icon registry for content-driven sections.
 *
 * Content stores an icon as a plain string (so the future admin UI can
 * offer a dropdown instead of shipping code), and this map turns it
 * back into a component. An unknown key falls back to `Sparkles`
 * rather than crashing — the same defensive rule `lib/theme.ts` uses
 * for malformed theme files.
 *
 * We deliberately use `@medusajs/icons` (already a dependency, and what
 * the rest of the storefront imports) instead of adding Lucide just for
 * four glyphs.
 *
 * The type is derived from the icons themselves rather than hand-written:
 * they are `ForwardRefExoticComponent`s whose `IconProps` is not
 * re-exported from the package root, and a structural `SVGProps` alias
 * would not accept them.
 */
type IconComponent = typeof BadgeCheck

const ICONS: Record<string, IconComponent> = {
  quality: BadgeCheck,
  price: Tag,
  sizes: Swatch,
  delivery: HandTruck,
}

export const FALLBACK_ICON: IconComponent = Sparkles

export function resolveIcon(key: string): IconComponent {
  return ICONS[key] ?? FALLBACK_ICON
}

/** Keys offered by the admin UI later on. */
export const AVAILABLE_ICON_KEYS = Object.keys(ICONS)
