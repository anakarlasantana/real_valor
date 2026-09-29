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
 */

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
