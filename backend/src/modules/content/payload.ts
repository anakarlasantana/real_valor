/**
 * A fronteira entre COLUNAS, CONTEÚDO e REFERÊNCIA no corpo que o CRM envia.
 * -------------------------------------------------------------------------
 * Uma seção é uma linha com colunas fixas — `surface`, `type`, `enabled`,
 * `position`, `fixed` (ver `models/content-section.ts`) — e um `data` JSON com o
 * que o tipo define (`contract.ts`). O corpo que o CRM manda, porém, é achatado:
 * `{ enabled, position, headline, imageUrl, productIds, … }`, porque é assim que
 * o formulário o monta. Alguém tem que dizer onde cada chave cai — e desde a
 * curadoria são **três** destinos, não dois.
 *
 * **Coluna:** o que se filtra ou ordena, poucas e conhecidas
 * (`COLUMN_COERCIONS`). Tudo o mais é conteúdo do tipo — não há ambiguidade a
 * resolver: nenhum campo do contrato se chama `surface`, `type`, `enabled`,
 * `position` ou `fixed`, e `payload.unit.spec.ts` confere isso contra
 * `SECTION_FIELDS`, para o dia em que alguém quiser criar um campo com um desses
 * nomes (a resposta certa é renomear o campo).
 *
 * **Referência:** `productIds` (a curadoria) e `filters` (os chips de categoria)
 * **não** são coluna nem conteúdo — são links do Medusa (`curation.ts`,
 * `filters.ts`). Os dois saem daqui separados, mas por chaves diferentes, e a
 * diferença é de propósito:
 *
 *   `productIds`  não é campo de contrato — a curadoria não tem editor no CRM,
 *                 então validá-lo como `data` seria reprová-lo;
 *   `filters`     é campo de contrato (o CRM escolhe as categorias no
 *                 formulário), e o que a lista guarda é o **id** da categoria,
 *                 nunca o texto dela.
 *
 * Sem a segunda linha `filters` continuaria sendo `data` — o defeito que a fase
 * conserta: o chip era o rótulo digitado, e a loja o mandava como busca. Quem
 * valida o valor dos dois (lista de ids, sem repetição, todos existentes) é a
 * rota admin; aqui só se diz para onde a chave vai.
 *
 * **A regra já foi outra, e custou caro.** `title` era coluna (o rótulo da
 * listagem) **e** campo de conteúdo em quatro tipos (`collections`, `featured`,
 * `editorial`, `instagram`), então a divisão precisava consultar o schema do tipo
 * para desempatar. Quem pagava era o lojista: tratado como coluna, o PATCH
 * respondia 200, a vitrine não mudava e o "Título" digitado ia para uma coluna
 * que nada lê. A coluna `title` foi removida em 2026-09-29 (ver
 * `models/content-section.ts`) e o `title` do corpo passou a ser sempre
 * conteúdo — que é onde ele é desenhado.
 *
 * A função é pura e **não muda o corpo recebido**: a rota continua lendo o
 * `type` do mesmo objeto depois de dividi-lo.
 */
import { CURATION_FIELD } from "./curation"
import { FILTERS_FIELD } from "./filters"

/**
 * As chaves que são coluna da seção, e como cada uma é convertida.
 *
 * A conversão continua aqui (e não é delegada ao banco) porque o corpo chega
 * como JSON cru: `enabled` pode vir `"true"`, `position` pode vir `"30"`. O
 * que o campo significa é do contrato; o que ele é **na linha** é desta
 * tabela.
 */
const asBoolean = (value: unknown): boolean =>
  // `Boolean("false")` é `true`, e um corpo escrito à mão (um `curl`, um script
  // de seed) com `enabled: "false"` ligaria a seção sem ninguém ver. A coluna é
  // booleana de verdade: a string é recusada antes da conversão.
  value !== false && value !== "false" && value !== 0

const COLUMN_COERCIONS: Record<string, (value: unknown) => unknown> = {
  enabled: asBoolean,
  // Mesma armadilha do `enabled`, mesma resposta. O CRM não manda esta coluna
  // (a tela decide por ela, não sobre ela — ver `models/content-section.ts`),
  // mas quem chama a API direto pode, e `"false"` não pode virar `true`.
  fixed: asBoolean,
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
  /**
   * A curadoria, **como veio** — e `undefined` quando a chave não estava no
   * corpo, que é diferente de `[]`: `undefined` é "não mexe na curadoria" (o
   * PATCH que só mudou um texto) e `[]` é "esvazia". Quem valida (lista de ids,
   * sem repetição, todos existentes) é a rota.
   */
  curation?: unknown
  /**
   * Os campos de contrato que são **referência**, como vieram no corpo.
   *
   * Hoje é só `filters` (os chips de categoria), e o destino dele é o link —
   * ver `modules/content/filters.ts`. Vale a mesma leitura do `curation`: chave
   * ausente é "não mexe" (o PATCH de um texto não encosta na lista de
   * categorias da seção) e `[]` é "esvazia os chips".
   */
  references?: Record<string, unknown>
}

/** Divide o corpo entre colunas da seção, `data`, a curadoria e os chips. */
export function splitPayload(body: Record<string, unknown>): SplitPayload {
  const columns: Record<string, unknown> = {}
  const data: Record<string, unknown> = {}
  const references: Record<string, unknown> = {}
  let curation: unknown

  for (const [key, value] of Object.entries(body)) {
    // `id` e `type` são identidade da seção, não conteúdo: quem os define é a
    // rota — o `id` do query param no PATCH, o tipo já validado no POST.
    // Aceitos e ignorados, como antes.
    if (key === "id" || key === "type") {
      continue
    }

    // A curadoria é referência, não conteúdo: `productIds` fora do `data`, e
    // daqui para o link. Ver o cabeçalho deste arquivo.
    if (key === CURATION_FIELD) {
      curation = value
      continue
    }

    // Os chips também — e `filters` é a única chave que é campo de contrato
    // (o CRM a desenha) **e** referência (o valor é o id da categoria). Fora do
    // `data`, o rótulo digitado deixa de ter onde morar.
    if (key === FILTERS_FIELD) {
      references[FILTERS_FIELD] = value
      continue
    }

    const coerce = COLUMN_COERCIONS[key]

    if (coerce) {
      columns[key] = coerce(value)
      continue
    }

    data[key] = value
  }

  return {
    columns,
    data,
    // As chaves opcionais saem só quando têm o que dizer: um corpo sem
    // referência nenhuma continua sendo `{ columns, data }`, como antes.
    ...(Object.keys(references).length ? { references } : {}),
    ...(curation === undefined ? {} : { curation }),
  }
}
