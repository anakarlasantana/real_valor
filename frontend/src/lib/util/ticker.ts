/**
 * O ticker da barra de anúncio: que mensagens entram e quão rápido elas rolam.
 * -------------------------------------------------------------------------
 * Três decisões pequenas e independentes, e as três com caso de borda:
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
 *   3. **Quantas mensagens cabem numa volta** (`tickerCopies`). O
 *      `translateX(-50%)` do keyframe leva uma volta inteira pela tela; se a
 *      volta for mais estreita que a tela, o texto sai pela esquerda e o vão
 *      entra pela direita **antes** de a cópia chegar — a mensagem seguinte
 *      aparece no meio da barra em vez de entrar pela borda, uma vez por volta.
 *      É o defeito que a faixa do Instagram já tinha resolvido (`marquee.ts`,
 *      caso 1) e que aqui ficou aberto: com duas mensagens curtas a volta tem um
 *      terço da largura de uma tela de 1440.
 *
 * Os três números e a regra das mensagens são espelho do contrato mantido à mão
 * de propósito: este é código de **cliente**, e importar `SECTION_FIELDS` aqui
 * levaria o contrato inteiro para o bundle do navegador por causa de três
 * números. Quem confere o espelho é `ticker.spec.ts` (o último `describe`):
 * faixa divergente reprova `make test` — era o que
 * `scripts/check-contract-parity.mjs` fazia por texto antes do G4.
 */

/** Piso da faixa: abaixo disto a linha cruza rápido demais para ser lida. */
export const ANNOUNCEMENT_SPEED_MIN = 8

/** Teto da faixa: acima disto o ticker parece parado (e parece quebrado). */
export const ANNOUNCEMENT_SPEED_MAX = 60

/** A velocidade quando a seção não diz: a mesma do conteúdo padrão (24s). */
export const ANNOUNCEMENT_SPEED_DEFAULT = 24

/**
 * Quantas mensagens uma volta do ticker precisa ter, no mínimo, para cobrir a
 * tela.
 *
 * O pior caso é a barra com duas mensagens curtas — o conteúdo que está no ar —,
 * com o texto em `rv-eyebrow` (11px, caixa alta, `.22em` de entreletra): as duas
 * somam ~560px, um terço de uma tela de 1440. Oito mensagens são a lista repetida
 * quatro vezes, ~2240px — o dobro do container da loja (1440), que é a mesma
 * folga que a faixa do Instagram declara em `MARQUEE_MIN_TILES` e pela mesma
 * razão: a conta não pode depender de uma medida de tela que o CSS é quem tem.
 *
 * Acima deste número quem cobre a tela é o **piso** (`min-width: 100vw`, em
 * `.rv-announce-strip .rv-marquee-group`): num monitor de 2560, oito mensagens de
 * ~280px ainda somam menos que a largura, e é o piso que fecha a volta.
 */
export const ANNOUNCEMENT_MIN_MESSAGES = 8

/**
 * Quantas vezes a lista de mensagens se repete dentro de uma volta do ticker.
 *
 * Sempre **1 ou mais**: a lista vazia não chega aqui (a barra não é desenhada) e
 * a mensagem única também não (com uma mensagem não há laço — a barra é a linha
 * centrada de sempre). O que a função garante é que uma volta com duas mensagens
 * não fique com duas linhas de texto no meio de uma tela de 1440px.
 *
 * **As duas metades da correção, e por que as duas existem.** Esta conta é o
 * **ritmo**: repetida, a lista enche a volta com o mesmo vão entre mensagens que
 * ela tem hoje — a velocidade sentida não muda. O **piso**
 * (`.rv-announce-strip .rv-marquee-group`, no `brand.css`) é a **garantia**: uma
 * volta mais estreita que a tela ainda abriria o vão — com uma mensagem curta
 * demais, ou numa tela mais larga que a volta cheia —, e é o `min-width: 100vw`
 * que a cobre. Sem as cópias, o piso esticaria duas mensagens por uma tela
 * inteira, com um vão enorme no meio; sem
 * o piso, as cópias dariam conta do conteúdo real e deixariam o caso extremo
 * aberto.
 */
export function tickerCopies(messages: number): number {
  if (!Number.isFinite(messages) || messages < 2) {
    return 1
  }

  return Math.max(1, Math.ceil(ANNOUNCEMENT_MIN_MESSAGES / messages))
}

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
 * A duração da **volta** do ticker, em segundos — o que o CSS anima.
 *
 * O `translateX(-50%)` do keyframe leva uma volta inteira (lista × cópias) pela
 * tela, então a duração é `segundos por volta da lista × cópias`. É essa
 * multiplicação que mantém `speedSeconds` sendo o que o rótulo do contrato diz
 * ("Segundos por volta"): a mesma mensagem volta a aparecer a cada
 * `speedSeconds`, com duas mensagens ou com dezesseis — o que muda é o
 * comprimento da volta, não o ritmo.
 *
 * Com uma mensagem só a volta é a própria lista (uma cópia), e a barra **não**
 * chama esta conta nesse caso: sem laço, ela é a linha centrada, parada.
 */
export function tickerLapSeconds(messages: number, value: unknown): number {
  return tickerSeconds(value) * tickerCopies(messages)
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
