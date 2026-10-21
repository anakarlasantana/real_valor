/**
 * Quem do catálogo entra no `sitemap.xml`: a mesma régua do 404 — **não se
 * anuncia o que não abre**. Produto esgotado (`productStatus`, a função do
 * card) e categoria sem peça ficam de fora.
 */
import { productStatus, type AvailabilityProduct } from "./product-availability"

export type SitemapProduct = AvailabilityProduct & {
  handle?: string | null
  updated_at?: string | Date | null
  categories?: ({ handle?: string | null } | null)[] | null
}

export type SitemapGroup = {
  handle?: string | null
  updated_at?: string | Date | null
}

export type EntradaDoCatalogo = {
  /** O caminho já montado (`/products/camisa`), sem país. */
  path: string
  lastModified?: Date
  changeFrequency: "daily" | "weekly" | "monthly"
  priority: number
}

export function caminhoDoProduto(handle: string): string {
  return `/products/${handle}`
}

/** As peças com `handle` e **não esgotadas**, na ordem do catálogo. */
export function produtosDoCatalogo(
  produtos: readonly SitemapProduct[]
): EntradaDoCatalogo[] {
  return produtos
    .filter((produto) => Boolean(produto.handle) && !esgotado(produto))
    .map((produto) => ({
      path: caminhoDoProduto(produto.handle as string),
      lastModified: quando(produto.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }))
}

/** As categorias e coleções com `handle` que estão em `comPeca`. */
export function gruposDoCatalogo(
  prefixo: "categories" | "collections",
  grupos: readonly SitemapGroup[],
  comPeca: ReadonlySet<string>,
  prioridade = 0.7
): EntradaDoCatalogo[] {
  return grupos
    .filter((grupo) => Boolean(grupo.handle) && comPeca.has(grupo.handle as string))
    .map((grupo) => ({
      path: `/${prefixo}/${grupo.handle}`,
      lastModified: quando(grupo.updated_at),
      changeFrequency: "weekly",
      priority: prioridade,
    }))
}

function esgotado(produto: SitemapProduct): boolean {
  return productStatus(produto) === "esgotado"
}

/** O `updated_at` como `Date`; data inválida sai `undefined` (o XML recusa). */
function quando(valor?: string | Date | null): Date | undefined {
  if (!valor) {
    return undefined
  }

  const data = valor instanceof Date ? valor : new Date(valor)

  return Number.isNaN(data.getTime()) ? undefined : data
}

/** O caminho completo na loja localizada: `<base>/<país><caminho>`. */
export function enderecoDaEntrada(
  base: string,
  pais: string,
  path: string
): string {
  return `${base}/${pais}${path}`
}
