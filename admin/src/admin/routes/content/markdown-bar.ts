/**
 * A barra de marcas do texto formatado — o que um botão faz com a seleção.
 * -------------------------------------------------------------------------
 * O **formato** está decidido (14.6.3 do doc 14): o texto longo guarda texto
 * com um subconjunto fechado de marcas inline, nunca HTML. Quem escreve a marca
 * é este módulo, e a lista das marcas **não** mora aqui: ela chega pelo `schema`
 * (`markdownMarks`, gerado de `MARKDOWN_MARKS` no contrato), porque o painel é
 * um pacote separado e não importa valor do contrato — a barra desenha o que o
 * registro diz, e um botão novo no contrato aparece sem edição aqui.
 *
 * Fica num arquivo próprio, e não dentro do `field-input.tsx`, como o
 * `form-draft.ts` e o `list-order.ts`: é regra, não desenho — dá para testar sem
 * navegador, e o teste mora ao lado (`__tests__/markdown-bar.unit.spec.ts`).
 *
 * **A decisão de onde a marca entra é daqui.** O que entra é o texto, a seleção
 * e o par da marca; o que sai é o texto novo e a seleção nova. O componente só
 * aplica os dois no `<textarea>` — é o que faz esta regra valer sem React, e o
 * que impede a mesma decisão de existir duas vezes (uma aqui, outra no JSX).
 */
import type { MarkdownMark } from "@conteudo/contract"

/** A seleção do `<textarea>`, como o DOM a devolve. */
export type MarkSelection = { start: number; end: number }

export type MarkedText = {
  /** O texto com a marca aplicada — ou **sem** ela, quando o botão desfaz. */
  text: string
  /** Onde a seleção fica depois: dentro das marcas, ou sobre o texto marcado. */
  selection: MarkSelection
}

/**
 * O que esta função precisa saber de uma marca.
 *
 * `open`/`close` são os de `MARKDOWN_MARKS`, e só eles importam aqui: as marcas
 * simétricas (`**texto**`) têm os dois iguais, e a de link (`[texto](/rota)`)
 * não. Nada nesta função sabe o que é negrito — quem sabe é o parser da loja.
 */
type Wrap = Pick<MarkdownMark, "open" | "close">

/**
 * Aplica — ou desfaz — uma marca na seleção.
 *
 * Três casos, e são os três que o lojista encontra:
 *
 *   1. **A seleção já está entre as marcas** (o botão apertado duas vezes, ou o
 *      cursor entre um par recém-inserido): as marcas saem e o texto fica
 *      selecionado. Sem isso, tirar um negrito seria apagar `**` na mão no meio
 *      de um texto longo;
 *   2. **A seleção tem texto**: o texto é envolvido e **continua selecionado**,
 *      para o próximo botão valer sobre ele (negrito e itálico no mesmo trecho);
 *   3. **A seleção é vazia**: o par entra e o cursor fica no meio, pronto para
 *      digitar — o gesto de quem clica em "Negrito" antes de escrever.
 *
 * A seleção vem fora do texto de propósito: quem a conhece é o `<textarea>`, e
 * uma posição inventada aqui (o fim do texto, por exemplo) marcaria a palavra
 * errada, em silêncio.
 */
export function toggleMark(
  text: string,
  selection: MarkSelection,
  { open, close }: Wrap
): MarkedText {
  // Posição fora da string acontece (o valor pode ter sido trocado por baixo,
  // entre o render e o clique): aparar aqui evita `slice` silenciosamente
  // errado, que é o defeito clássico de quem mexe só no texto e não na seleção.
  const inicio = Math.max(0, Math.min(selection.start, selection.end, text.length))
  const fim = Math.max(0, Math.min(Math.max(selection.start, selection.end), text.length))

  const antes = text.slice(inicio - open.length, inicio)
  const depois = text.slice(fim, fim + close.length)

  // (1) já marcado: desfaz
  if (antes === open && depois === close) {
    return {
      text:
        text.slice(0, inicio - open.length) +
        text.slice(inicio, fim) +
        text.slice(fim + close.length),
      selection: {
        start: inicio - open.length,
        end: fim - open.length,
      },
    }
  }

  // (2) e (3): envolve a seleção — que pode ser vazia — e deixa o cursor dentro
  return {
    text: `${text.slice(0, inicio)}${open}${text.slice(inicio, fim)}${close}${text.slice(fim)}`,
    selection: {
      start: inicio + open.length,
      end: fim + open.length,
    },
  }
}

/**
 * A marca escrita, para o `title` do botão — `**texto**`, `[texto](/rota)`.
 *
 * O rótulo do botão é o nome da marca ("Negrito"); a dica mostra o que vai
 * aparecer no texto. Quem já conhece as marcas reconhece as duas, e quem não
 * conhece é quem mais precisa ver que o negrito vai ficar escrito como `**`.
 */
export function markExample({ open, close }: Wrap): string {
  return `${open}texto${close}`
}
