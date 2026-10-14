/**
 * Alteração pendente no formulário de uma seção.
 * -------------------------------------------------------------------------
 * O CRM decide se mostra a barra de "Salvar" comparando o que está na tela com o
 * que veio do servidor. Essa comparação decide **acesso a salvar**, então ela é
 * uma decisão testável (`form-draft.unit.spec.ts`) e não um `JSON.stringify`
 * solto na tela.
 *
 * O `JSON.stringify` não serve: um campo numérico do formulário devolve `"8"` e
 * o servidor guardou `8`, e a barra acenderia sozinha numa seção intocada — o
 * aviso que não merece confiança é pior do que a ausência dele.
 *
 * E é também aqui que o valor da tela vira o valor **da API** (`wireValue`): um
 * campo de referência é um objeto na tela (o chip precisa do nome para ser
 * desenhado) e uma lista de ids no corpo — a conversão mora num lugar só, com
 * teste, em vez de dentro do `onSave`.
 *
 * O `import type` vem pelo alias `@conteudo/*` (`admin/tsconfig.json`), que aponta
 * para o módulo do conteúdo no backend: o vínculo tem nome em vez de cinco
 * níveis de `..` (ver docs/plano-centralizacao.md, R2).
 */
import type { FieldKind } from "@conteudo/contract"

/** Uma impressão do valor, para comparar formulário e conteúdo gravado. */
export function fingerprint(value: unknown): string {
  if (value === undefined || value === null) {
    return ""
  }

  return typeof value === "object" ? (JSON.stringify(value) ?? "") : String(value)
}

/**
 * O rascunho do formulário difere do que está gravado?
 *
 * Compara **todas** as chaves dos dois lados, e não só as do schema: um campo que
 * saiu do contrato mas continua no `data` gravado não pode virar "alteração" por
 * estar ausente do formulário, nem sumir da conta se o formulário o trouxer.
 */
export function isDirty(
  draft: Record<string, unknown>,
  saved: Record<string, unknown>
): boolean {
  const keys = new Set([...Object.keys(draft), ...Object.keys(saved)])

  for (const key of keys) {
    if (fingerprint(draft[key]) !== fingerprint(saved[key])) {
      return true
    }
  }

  return false
}

/**
 * Um texto colado virando a lista de mensagens do ticker.
 *
 * A vírgula e a quebra de linha são **gesto de colagem**, não separador de
 * digitação: o campo da barra de anúncio é uma caixa por mensagem desde o
 * conserto do `list:text`, e colar ("Frete grátis, Troca fácil") abre várias
 * caixas de uma vez.
 *
 * Separador que se consome enquanto se digita era o defeito do campo antigo: a
 * lista era remontada a cada tecla (`join` para exibir, `split` para gravar), e
 * a vírgula recém-digitada sumia — as mensagens colavam numa só e o ticker, que
 * precisa de duas, não rolava.
 */
export function parseTextList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * O valor de um campo, como a **API** o recebe.
 *
 * Um campo de referência (`list:category`, os chips de categoria) viaja como a
 * lista de **ids**: o que se grava é a referência, e o rótulo é lido ao vivo da
 * categoria (`backend/src/modules/content/filters.ts`). A tela, porém, precisa
 * do nome — é ele que o chip desenha —, então o rascunho guarda o objeto
 * inteiro e a conversão acontece aqui.
 *
 * Sem ela o corpo levaria `{ categoryId, label, handle }` e a rota recusaria com
 * "deve ser uma lista de ids de categoria" — que é a resposta certa, mas por um
 * motivo que o lojista não tem como consertar pela tela.
 *
 * A outra conversão é a das caixas do ticker (`list:text`): a tela guarda o
 * texto cru — inclusive a caixa vazia que o lojista acabou de criar e ainda vai
 * preencher — e o corpo leva a lista limpa. Item em branco não é mensagem: o
 * storefront já os descarta (`tickerMessages`), e mandá-los faria a seção
 * gravar `["", "Frete grátis"]` por causa de uma caixa recém-aberta.
 *
 * Fora essas duas, o formulário vai como está: o que a tela mostra é o que a
 * API grava.
 */
export function wireValue(kind: FieldKind, value: unknown): unknown {
  if (kind === "list:text") {
    return Array.isArray(value)
      ? (value as unknown[])
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : value
  }

  if (kind !== "list:category" || !Array.isArray(value)) {
    return value
  }

  return value
    .map((chip) => (chip as { categoryId?: unknown } | null)?.categoryId)
    .filter((id): id is string => typeof id === "string" && Boolean(id))
}
