/**
 * A faixa do Instagram: quantas vezes a lista se repete e quão devagar ela anda.
 * O movimento é o do ticker da barra de anúncio (`.rv-marquee`), emprestado de
 * propósito — quem move é o CSS, e o arrasto é um *seek* do `animation-delay`.
 */

/** Piso da faixa: abaixo disto a foto cruza rápido demais para ser vista. */
export const INSTAGRAM_SPEED_MIN = 3

/** Teto da faixa: acima disto a faixa parece parada (e parece quebrada). */
export const INSTAGRAM_SPEED_MAX = 12

/** A velocidade quando a seção não diz: a mesma do conteúdo padrão (6s). */
export const INSTAGRAM_SPEED_DEFAULT = 6

/** Piso de quadros por volta para cobrir a tela: o pior caso é o container de
 * 1440px com o quadro no máximo (`clamp(200px, 24vw, 340px)`, ≈4,1 quadros);
 * oito é o dobro, folga para monitor largo e para não medir a tela. */
export const MARQUEE_MIN_TILES = 8

/** Quantas vezes a lista se repete numa volta: sempre **1 ou mais** (a lista
 * vazia não chega aqui). Uma imagem só devolve 1, e a seção não usa o resultado:
 * repetir uma foto oito vezes é uma faixa de cópias — aí ela desenha a grade. */
export function marqueeCopies(images: number): number {
  if (!Number.isFinite(images) || images < 2) {
    return 1
  }

  return Math.max(1, Math.ceil(MARQUEE_MIN_TILES / images))
}

/** Segundos por imagem, dentro da faixa. Aceita `6`/`"6"` e fração; número não
 * finito cai no **padrão**, não no teto: `Infinity` de campo vazio é ausência de
 * informação, não pedido de faixa lenta. */
export function instagramSecondsPerImage(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return INSTAGRAM_SPEED_DEFAULT
  }

  return Math.min(
    Math.max(parsed, INSTAGRAM_SPEED_MIN),
    INSTAGRAM_SPEED_MAX
  )
}

/** A duração da **volta**, em segundos — o que o CSS anima: segundos por imagem
 * × quadros da volta, o que faz o campo ser "por imagem" também na tela. Com
 * menos de duas imagens a seção não chama esta conta (desenha a grade parada). */
export function marqueeSeconds(images: number, value: unknown): number {
  return instagramSecondsPerImage(value) * images * marqueeCopies(images)
}

/** Quanto tempo de faixa vale um arrasto de `dx` px — o arrasto é um **seek**.
 * Devolve segundos de animação, que vão no `animation-delay` do trilho (negativo,
 * em `instagram-grid/strip.tsx`): o trilho anda `period` px em `duration`
 * segundos, então `dx` px valem `(dx / period) × duration`. O sinal é o do gesto
 * (quem chama passa `xInicial - xAtual`: com o sinal trocado a faixa anda ao
 * contrário do dedo, e parece "peso", não erro de conta). O arrasto não é preso à
 * volta — o navegador lê o resto da divisão sozinho. E medida ausente (`period`
 * zero ou `NaN`) devolve 0: um `animation-delay: -NaN` é **ignorado em silêncio**
 * e a faixa pararia de responder ao arrasto sem erro nenhum no console. */
export function marqueeSeekOffset(
  dx: number,
  period: number,
  duration: number
): number {
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(period) ||
    !Number.isFinite(duration) ||
    period <= 0 ||
    duration <= 0
  ) {
    return 0
  }

  return (dx / period) * duration
}
