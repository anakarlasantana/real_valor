/**
 * A ordem dos itens de uma lista, e como um item se apresenta na tela.
 * -------------------------------------------------------------------------
 * Duas decisões do editor de conteúdo, as duas puras e as duas fora do
 * componente pelo mesmo motivo que `form-draft.ts` está fora do formulário: o
 * `ObjectListInput` é JSX, e o que se quer prender aqui não é o desenho — é a
 * conta e o texto. Quem as testa é `__tests__/list-order.unit.spec.ts`.
 *
 *   1. **A ordem é da lista, e quem a mexe são as setas.** O CRM já tinha essa
 *      regra nos chips de categoria; o `ObjectListInput` (slides da capa,
 *      benefícios, coleções, links do rodapé) ficou sem ela, e a posição do item
 *      é o que a API grava em `position`. Trocar dois itens de lugar é trocar
 *      duas posições — e no lugar de um fica o outro.
 *
 *   2. **O item se apresenta pelo próprio conteúdo.** "Item 2" não diz qual
 *      slide é: para achar o slide da foto do vestido, o lojista abria os itens
 *      um a um. O resumo lê os campos **na ordem em que o sub-formulário os
 *      declara** — a ordem do `ITEM_FIELDS` do contrato, que chega no
 *      `itemFields` do payload —, e não uma lista de nomes escrita aqui: um
 *      campo novo dentro do item já vale como resumo sem edição neste arquivo.
 *
 * O `import type` vem pelo alias `@conteudo/*` (`admin/tsconfig.json`), como em
 * `form-draft.ts`: o nome do tipo mora no contrato, e o `import type` desaparece
 * no build (não há dependência de runtime nem de empacotamento).
 */
import type { ItemFieldSpec } from "@conteudo/contract"

/**
 * Onde o resumo corta.
 *
 * O cabeçalho do item é uma linha com `Item N`, o resumo, as setas e o
 * "Remover": um resumo longo empurraria os controles para fora da vista, e o que
 * ele acrescenta além disso é precisão que o item aberto já dá.
 */
const SUMMARY_MAX = 42

/**
 * A lista com dois itens trocados de lugar.
 *
 * Movimento fora da faixa — a seta do primeiro item para cima, a do último para
 * baixo — devolve **a mesma lista**. Quem chama não precisa saber se o movimento
 * aconteceu (as setas estão desabilitadas nas pontas, e um clique não pedido não
 * muda nada), e gravar o valor que já estava lá não acende o "Salvar".
 */
export function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta

  if (
    index < 0 ||
    index >= items.length ||
    target < 0 ||
    target >= items.length
  ) {
    return items
  }

  const next = [...items]

  ;[next[index], next[target]] = [next[target], next[index]]

  return next
}

/**
 * O que o item diz de si mesmo no cabeçalho — uma linha curta, possivelmente
 * vazia (item recém-criado não tem conteúdo nenhum, e aí só o numeral aparece).
 */
export function itemSummary(
  fields: readonly ItemFieldSpec[],
  item: Record<string, unknown>
): string {
  const text = fields.find(
    (field) => isSummaryText(field) && hasText(item[field.name])
  )

  if (text) {
    return shorten(valueOf(item[text.name]))
  }

  // Sem texto, o que sobra é a foto (a coleção, o Instagram): o nome do arquivo
  // é o resto de informação que o upload deixa, e é melhor do que "Item 3".
  const image = fields.find(
    (field) => field.kind === "image" && hasText(item[field.name])
  )

  return image ? shorten(basename(valueOf(item[image.name]))) : ""
}

/**
 * O campo serve de resumo?
 *
 * Lista dentro do item não é resumo de coisa nenhuma (o rodapé guarda os links
 * dentro da coluna). A foto também não entra aqui: o nome de um upload é um
 * carimbo de tempo, e o título da capa diz muito mais — por isso ela é o
 * **último** recurso, em `itemSummary`. O que sobra é texto do lojista, que é
 * exatamente o que ele procura quando lê a lista.
 */
function isSummaryText(field: ItemFieldSpec): boolean {
  const kind = field.kind

  // `kind` ausente é campo simples de texto (o contrato só o declara para item
  // que é lista ou escolha) — e é o melhor resumo que existe.
  if (!kind) {
    return true
  }

  return !kind.startsWith("list:") && kind !== "image" && kind !== "hex"
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== ""
}

function valueOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** A última parte de um caminho, sem a extensão: `…/foto.png` vira `foto`. */
function basename(value: string): string {
  const path = value.split(/[?#]/)[0] ?? ""
  const last = path.split("/").filter(Boolean).pop() ?? ""

  return last.replace(/\.(png|jpe?g|webp|avif|gif|svg)$/i, "")
}

/** Espaço dobrado, e o corte com reticências. */
function shorten(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim()

  return flat.length > SUMMARY_MAX
    ? `${flat.slice(0, SUMMARY_MAX).trimEnd()}…`
    : flat
}
