/**
 * Quantos produtos o trilho de lançamentos mostra: o campo `limit` (contrato
 * `SECTION_FIELDS.launches`, 2 a 12) vem do banco; a função resolve o que a
 * validação não cobre — ausente/lixo (o SDK devolve 12) e fora da faixa.
 */

/** Piso da faixa: um card e meio já não é trilho. */
export const LAUNCHES_LIMIT_MIN = 2

/** Teto da faixa: acima disso o trilho vira o catálogo inteiro. */
export const LAUNCHES_LIMIT_MAX = 12

/** O tamanho quando a seção não diz: o mesmo do conteúdo padrão (8). */
export const LAUNCHES_LIMIT_FALLBACK = 8

/** O `limit` da seção, dentro da faixa. Aceita `8`/`"8"` (o `data` do bloco é
 * JSON e o número pode ter virado texto) e arredonda para baixo (é contagem de
 * cards). Número não finito cai no **padrão**, não no teto: `Infinity` de campo
 * vazio é ausência de informação, não pedido de catálogo inteiro. */
export function launchesLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return LAUNCHES_LIMIT_FALLBACK
  }

  return Math.min(Math.max(Math.floor(parsed), LAUNCHES_LIMIT_MIN), LAUNCHES_LIMIT_MAX)
}
