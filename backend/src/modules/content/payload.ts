/**
 * A fronteira entre COLUNAS e CONTEÚDO no corpo que o CRM envia.
 * -------------------------------------------------------------------------
 * Um bloco de conteúdo é uma linha com colunas fixas — `title`, `enabled`,
 * `position`, `surface` (ver `models/content-block.ts`) — e um `data` JSON com
 * o que o tipo define (`contract.ts`). O corpo que o CRM manda, porém, é
 * achatado: `{ enabled, position, headline, imageUrl, … }`, porque é assim que
 * o formulário o monta. Alguém tem que dizer onde cada chave cai.
 *
 * **A regra é o schema do tipo, não o nome da chave.** `title` é o caso que
 * obrigou a escrever isto: é coluna (o rótulo da listagem) **e** campo de
 * conteúdo em quatro tipos (`collections`, `featured`, `editorial`,
 * `instagram`). Tratá-lo sempre como coluna — como era antes — fazia o
 * formulário salvar um "Título" que a loja nunca lia: o `data.title` (é o que
 * o storefront desenha) ficava intacto, o PATCH respondia 200 e o lojista lia
 * "Conteúdo salvo" sem nada mudar na vitrine.
 *
 * A função é pura e **não muda o corpo recebido**: a rota continua lendo o
 * `type` do mesmo objeto depois de dividi-lo.
 */

/**
 * As chaves que são coluna do bloco, e como cada uma é convertida.
 *
 * A conversão continua aqui (e não é delegada ao banco) porque o corpo chega
 * como JSON cru: `enabled` pode vir `"true"`, `position` pode vir `"30"`. O
 * que o campo significa é do contrato; o que ele é **na linha** é desta
 * tabela.
 */
const COLUMN_COERCIONS: Record<string, (value: unknown) => unknown> = {
  title: (value) => String(value),
  // `Boolean("false")` é `true`, e um corpo escrito à mão (um `curl`, um
  // script de seed) com `enabled: "false"` ligaria a seção sem ninguém ver.
  // A coluna é booleana de verdade: a string é recusada antes da conversão.
  enabled: (value) => value !== false && value !== "false" && value !== 0,
  position: (value) => Number(value),
  surface: (value) => String(value),
}

export type SplitPayload = {
  columns: Record<string, unknown>
  data: Record<string, unknown>
}
/**
 * Divide o corpo entre colunas e `data`.
 *
 * `fieldNames` são os nomes dos campos de `data` do tipo, como o schema os
 * declara (`schema.fields[type]`). Só isso é preciso para desempatar o
 * `title` — e é o que faz um campo novo no contrato cair no lugar certo sem
 * ninguém mexer nesta função.
 */
export function splitPayload(
  body: Record<string, unknown>,
  fieldNames: ReadonlySet<string>
): SplitPayload {
  const columns: Record<string, unknown> = {}
  const data: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    // `id` e `type` são identidade do bloco, não conteúdo: quem os define é a
    // rota — o `id` do query param no PATCH, o tipo já validado no POST.
    // Aceitos e ignorados, como antes.
    if (key === "id" || key === "type") {
      continue
    }

    const coerce = COLUMN_COERCIONS[key]

    // Campo do tipo ganha do nome da coluna: é o schema que decide.
    if (coerce && !fieldNames.has(key)) {
      columns[key] = coerce(value)
      continue
    }

    data[key] = value
  }

  return { columns, data }
}
