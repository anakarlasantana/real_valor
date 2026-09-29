/**
 * A fronteira entre COLUNAS e CONTEÚDO no corpo que o CRM envia.
 * -------------------------------------------------------------------------
 * Uma seção é uma linha com colunas fixas — `surface`, `type`, `enabled`,
 * `position` (ver `models/content-section.ts`) — e um `data` JSON com o que o
 * tipo define (`contract.ts`). O corpo que o CRM manda, porém, é achatado:
 * `{ enabled, position, headline, imageUrl, … }`, porque é assim que o
 * formulário o monta. Alguém tem que dizer onde cada chave cai.
 *
 * **A regra é o nome da coluna, e nada mais.** Coluna é o que se filtra ou
 * ordena, são poucas e estão em `COLUMN_COERCIONS`; tudo o mais é conteúdo do
 * tipo. Não há ambiguidade a resolver: nenhum campo do contrato se chama
 * `surface`, `type`, `enabled` ou `position` — e `payload.unit.spec.ts` confere
 * isso contra `SECTION_FIELDS`, para o dia em que alguém quiser criar um campo
 * com um desses nomes (a resposta certa é renomear o campo).
 *
 * **A regra já foi outra, e custou caro.** `title` era coluna (o rótulo da
 * listagem) **e** campo de conteúdo em quatro tipos (`collections`, `featured`,
 * `editorial`, `instagram`), então a divisão precisava consultar o schema do
 * tipo para desempatar. Quem pagava era o lojista: tratado como coluna, o PATCH
 * respondia 200, a vitrine não mudava e o "Título" digitado ia para uma coluna
 * que nada lê. A coluna `title` foi removida em 2026-09-29 (ver
 * `models/content-section.ts`) e o `title` do corpo passou a ser sempre
 * conteúdo — que é onde ele é desenhado.
 *
 * A função é pura e **não muda o corpo recebido**: a rota continua lendo o
 * `type` do mesmo objeto depois de dividi-lo.
 */

/**
 * As chaves que são coluna da seção, e como cada uma é convertida.
 *
 * A conversão continua aqui (e não é delegada ao banco) porque o corpo chega
 * como JSON cru: `enabled` pode vir `"true"`, `position` pode vir `"30"`. O
 * que o campo significa é do contrato; o que ele é **na linha** é desta
 * tabela.
 */
const COLUMN_COERCIONS: Record<string, (value: unknown) => unknown> = {
  // `Boolean("false")` é `true`, e um corpo escrito à mão (um `curl`, um
  // script de seed) com `enabled: "false"` ligaria a seção sem ninguém ver.
  // A coluna é booleana de verdade: a string é recusada antes da conversão.
  enabled: (value) => value !== false && value !== "false" && value !== 0,
  position: (value) => Number(value),
  surface: (value) => String(value),
}

/**
 * Os nomes das colunas da seção, para quem precisa conferir que nenhum campo
 * do contrato colide com eles (`payload.unit.spec.ts`).
 */
export const COLUMN_NAMES: readonly string[] = Object.keys(COLUMN_COERCIONS)

export type SplitPayload = {
  columns: Record<string, unknown>
  data: Record<string, unknown>
}

/** Divide o corpo entre colunas da seção e `data`. */
export function splitPayload(body: Record<string, unknown>): SplitPayload {
  const columns: Record<string, unknown> = {}
  const data: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    // `id` e `type` são identidade da seção, não conteúdo: quem os define é a
    // rota — o `id` do query param no PATCH, o tipo já validado no POST.
    // Aceitos e ignorados, como antes.
    if (key === "id" || key === "type") {
      continue
    }

    const coerce = COLUMN_COERCIONS[key]

    if (coerce) {
      columns[key] = coerce(value)
      continue
    }

    data[key] = value
  }

  return { columns, data }
}
