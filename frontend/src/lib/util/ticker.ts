/**
 * O ticker da barra de anúncio: que mensagens entram e quão rápido elas rolam.
 * -------------------------------------------------------------------------
 * Duas decisões pequenas e independentes, e as duas com caso de borda:
 *
 *   1. **Quais mensagens.** O campo é editável no CRM e o valor vem do banco,
 *      onde campo é texto livre: uma base antiga só tem `text` (a mensagem
 *      única, como a barra nasceu), uma base nova tem `messages`, e uma base
 *      editada à mão pode ter as duas, uma lista com item vazio, ou uma lista
 *      que não é lista. A regra é: `messages` limpo manda; sem ele, vale o
 *      `text` de sempre; sem os dois, a barra **não aparece** — melhor uma
 *      barra a menos do que uma faixa preta vazia no topo de toda página.
 *
 *   2. **Quão rápido.** O campo `speedSeconds` tem faixa declarada no contrato
 *      (`SECTION_FIELDS.announcement`: mínimo 8, máximo 60) e a API admin recusa
 *      valor fora dela — o que chega aqui, na prática, já está dentro. A função
 *      resolve o que a validação não cobre: ausente (base gravada antes de a
 *      faixa existir, `data` editado à mão) e lixo (`NaN` de campo vazio).
 *
 * Os três números e a regra das mensagens são espelho do contrato mantido à mão
 * — o storefront compila o artefato gerado, que **não** leva `SECTION_FIELDS`
 * (ele é só do CRM) —, e quem confere o espelho é
 * `scripts/check-contract-parity.mjs`: faixa divergente reprova o commit.
 */

/** Piso da faixa: abaixo disto a linha cruza rápido demais para ser lida. */
export const ANNOUNCEMENT_SPEED_MIN = 8

/** Teto da faixa: acima disto o ticker parece parado (e parece quebrado). */
export const ANNOUNCEMENT_SPEED_MAX = 60

/** A velocidade quando a seção não diz: a mesma do conteúdo padrão (24s). */
export const ANNOUNCEMENT_SPEED_DEFAULT = 24

/** O campo da barra, como ele chega do CMS — sem compromisso de tipo. */
export type TickerContent = {
  text?: unknown
  messages?: unknown
}

/**
 * Segundos por volta do ticker, dentro da faixa.
 *
 * Aceita número e string numérica (`24` e `"24"` são o mesmo valor — o `data` do
 * bloco é JSON, e o número pode ter virado texto numa edição), e aceita fração
 * (o campo é passo 1, mas a conta não depende disso: um `12.5` é uma velocidade
 * legítima). Número não finito cai no padrão, e não no teto: um `Infinity`
 * vindo de campo vazio é ausência de informação, não pedido de ticker lento.
 */
export function tickerSeconds(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return ANNOUNCEMENT_SPEED_DEFAULT
  }

  return Math.min(
    Math.max(parsed, ANNOUNCEMENT_SPEED_MIN),
    ANNOUNCEMENT_SPEED_MAX
  )
}

/**
 * As mensagens da barra, na ordem — uma lista possivelmente vazia.
 *
 * Lista vazia é resposta legítima: é ela que faz a barra não ser desenhada.
 * Item que não é texto, item em branco e espaço sobrando caem fora, porque o
 * que a lista carrega é uma linha de barra, e uma linha de barra em branco não é
 * mensagem — é o rastro de um campo limpo no CRM.
 */
export function tickerMessages(section: TickerContent): string[] {
  const messages = Array.isArray(section.messages)
    ? section.messages
        .filter((message): message is string => typeof message === "string")
        .map((message) => message.trim())
        .filter(Boolean)
    : []

  if (messages.length > 0) {
    return messages
  }

  const text = typeof section.text === "string" ? section.text.trim() : ""

  return text ? [text] : []
}
