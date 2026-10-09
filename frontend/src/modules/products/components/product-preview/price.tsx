import { clx } from "@medusajs/ui"
import { VariantPrice } from "types/global"

/**
 * O preço da peça, no card — o número que a vitrine promete manter à vista.
 * -------------------------------------------------------------------------
 * Ele era um `Text` do `@medusajs/ui` em `text-rv-muted`: cinza e do mesmo
 * tamanho do texto de apoio. Quem passava o olho pela vitrine via um borrão cinza
 * ao lado do título, e não **quanto custa** a peça — que é a primeira pergunta de
 * quem olha uma vitrine de roupa.
 *
 * O desenho agora é do `brand.css` (`.rv-price*`, com as cores medidas lá), e o
 * que sobra para este arquivo é a **ordem** e o que acontece quando a peça está
 * em oferta:
 *
 *   1. o preço de agora é o número (`.rv-price-value`: preto, semibold — e, no
 *      card, **13px**, pela regra `.rv-card-info .rv-price-value`, porque é o
 *      **nome** da peça o maior texto do card; ver o bloco do card em
 *      `brand.css`. Na página da peça o mesmo número continua com 1.125rem);
 *   2. o preço de antes, quando existe, vem **antes** dele e riscado
 *      (`.rv-price-was`, cinza): a leitura é "era 399, agora 249";
 *   3. em oferta o número de agora veste `--rv-rose-strong` — o rosa escuro da
 *      marca, e não o de assinatura, porque os 3,12:1 deste último não servem
 *      para texto (a conta está em `brand.css`).
 *
 * O `Text` do design system saiu daqui de propósito: ele impõe tamanho e cor por
 * classe, e classe nenhuma deste arquivo ganha do utilitário do Tailwind, que é
 * emitido depois — a aparência do preço tem de ser decidida em um lugar só.
 */
export default function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null
  }

  const onSale = price.price_type === "sale"

  return (
    <span className="rv-price">
      {onSale && (
        <span className="rv-price-was" data-testid="original-price">
          {price.original_price}
        </span>
      )}
      <span
        className={clx("rv-price-value", onSale && "rv-price-sale")}
        data-testid="price"
      >
        {price.calculated_price}
      </span>
      {/*
        O `-x%` no card. Ele existia só na página, e é no card que a cliente
        compara: sem o número, "era 399, agora 249" ela faz de cabeça (e às vezes
        não faz).

        Duas guardas, e as duas são de dado real: o `-0%` de uma promoção que
        igualou o preço (a `percentage_diff` é `"0"` quando não houve queda, e
        "-0%" é pior do que nada) e o rótulo do próprio `.rv-price-sale`, que é a
        cor de oferta que o `brand.css` mede.
      */}
      {onSale && price.percentage_diff !== "0" && (
        <span className="rv-price-sale" data-testid="price-off">
          -{price.percentage_diff}%
        </span>
      )}
    </span>
  )
}
