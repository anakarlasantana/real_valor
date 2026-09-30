import { clx } from "@medusajs/ui"

import {
  PRODUCT_STATUS_LABELS,
  productStatus,
  type AvailabilityProduct,
  type ProductStatus,
} from "@lib/util/product-availability"

/**
 * O chip de estado da peça — "Pronta entrega", "Sob demanda", "Últimas peças",
 * "Esgotado".
 *
 * Ele é burro de propósito: quem decide o estado é `productStatus`
 * (`lib/util/product-availability.ts`), que é testável sem renderizar nada, e
 * o que sobra para este arquivo é o mapa estado → classe e o rótulo. Um chip
 * que decidisse sozinho teria a regra duplicada no card e na página do produto,
 * e as duas versões discordariam no dia em que o estoque mudasse de forma.
 *
 * Sem `"use client"`: é um componente de servidor como o resto do card, e por
 * isso pode ser usado tanto no `product-preview` (servidor) quanto no
 * `product-actions` (cliente) — nada aqui tem estado, efeito ou evento.
 *
 * O `className` existe para **posicionar** (o card o sobrepõe à foto) sem que
 * cada chamador precise repetir a tipografia e as cores do chip.
 */

/** Estado → classe do `brand.css`. Um estado sem classe aqui seria um chip nu. */
const STATUS_CLASSES: Record<ProductStatus, string> = {
  "pronta-entrega": "rv-chip-pronta-entrega",
  "sob-demanda": "rv-chip-sob-demanda",
  ultimas: "rv-chip-ultimas",
  esgotado: "rv-chip-esgotado",
}

export default function ProductStatusChip({
  product,
  className,
}: {
  /** O produto como o catálogo o devolve — só `metadata`, `tags` e `variants`. */
  product: AvailabilityProduct
  className?: string
}) {
  const status = productStatus(product)

  return (
    <span className={clx("rv-chip", STATUS_CLASSES[status], className)}>
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  )
}
