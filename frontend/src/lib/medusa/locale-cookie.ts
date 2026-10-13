/** A leitura do cookie do idioma — a FOLHA que o SDK e o dado do locale usam. */
import { cookies as nextCookies } from "next/headers"

export const LOCALE_COOKIE_NAME = "_medusa_locale"

/** O idioma da visita, ou `null` — nunca lança (fora de request não há cookie). */
export async function readLocale(): Promise<string | null> {
  try {
    const cookies = await nextCookies()
    return cookies.get(LOCALE_COOKIE_NAME)?.value ?? null
  } catch {
    return null
  }
}
