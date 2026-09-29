/**
 * Quantos produtos o trilho de lançamentos mostra.
 * -------------------------------------------------------------------------
 * O campo `limit` da seção é um número escolhido no CRM, com faixa declarada no
 * contrato (`SECTION_FIELDS.launches`: mínimo 2, máximo 12, passo 1) — a API
 * admin recusa valor fora dela. Então, na prática, o que chega aqui já está
 * dentro. O que esta função resolve são os dois casos que a validação não cobre:
 *
 *   1. **Ausente ou lixo.** A seção é editável e o valor vem do banco, onde
 *      campo é texto livre: uma seção gravada antes da faixa existir, um
 *      `data` editado à mão, um schema mais novo que o storefront. Sem número
 *      o trilho não tem tamanho — e `listProducts` sem `limit` devolve 12 por
 *      conta própria, o que é um padrão escondido no SDK.
 *   2. **Fora da faixa.** `limit: 0` desenharia uma seção vazia (e a seção
 *      existe para mostrar peça); `limit: 500` mandaria o catálogo inteiro
 *      pela rede para o navegador esconder 490 cards.
 *
 * Os três números são espelho do contrato mantido à mão — o storefront compila
 * o artefato gerado, que **não** leva `SECTION_FIELDS` (ele é só do CRM) —, e
 * quem confere o espelho é `scripts/check-contract-parity.mjs`: faixa
 * divergente reprova o commit.
 *
 * Não é `Math.min(Math.max(...))` solto na página de propósito: é a decisão,
 * ela tem caso de borda (`infinito`, `NaN`, `"8"`, `0`) e ela é testável sem
 * renderizar nada.
 */

/** Piso da faixa: um card e meio já não é trilho. */
export const LAUNCHES_LIMIT_MIN = 2

/** Teto da faixa: acima disso o trilho vira o catálogo inteiro. */
export const LAUNCHES_LIMIT_MAX = 12

/** O tamanho quando a seção não diz: o mesmo do conteúdo padrão (8). */
export const LAUNCHES_LIMIT_FALLBACK = 8

/**
 * O `limit` da seção, dentro da faixa.
 *
 * Aceita número e string numérica (`8` e `"8"` são o mesmo valor — o `data` do
 * bloco é JSON, e o número pode ter virado texto numa edição), e arredonda para
 * baixo: o limite é contagem de cards, não fração. Número não finito (`NaN`,
 * `Infinity`) cai no padrão, e não no teto: um `Infinity` vindo de campo vazio
 * é ausência de informação, não pedido de catálogo inteiro.
 */
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
