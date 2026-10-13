import { readLocale } from "./locale-cookie"

export async function getLocaleHeader() {
  const locale = await readLocale()
  return {
    "x-medusa-locale": locale,
  } as const
}
