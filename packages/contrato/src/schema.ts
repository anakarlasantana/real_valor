/**
 * O schema do CRM: o que o formulário é, em um único objeto, montado de
 * `contract.ts`. Mora num lugar só porque a rota e o `seed-schema` precisam do
 * mesmo dado; o contrato é o bootstrap quando o registro do Postgres não existe.
 */
import {
  CONTENT_DESTINATIONS,
  CONTENT_SURFACES,
  CONTENT_TYPES,
  ITEM_FIELDS,
  MARKDOWN_MARKS,
  SECTION_FIELDS,
  SECTION_TYPE_LABELS,
  SINGLETON_SECTION_TYPES,
  THEME_COLOR_HEXES,
  THEME_DARK_TOKENS,
  THEME_FIELDS,
  THEME_FONTS,
  THEME_TYPE,
  THEME_TYPE_LABEL,
  type ContentDestination,
  type ContentSurfaceSpec,
  type FieldSpec,
  type ItemFieldSpec,
  type MarkdownMark,
} from "./contract.ts"

/**
 * A versão do schema: `seed-schema` carimba na escrita, e ela sobe quando o
 * formato muda (chave, campo ou tipo novo). Sem `make seed-schema` o CRM desenha
 * o formulário antigo e a API **recusa** os campos novos — o `--check` acusa.
 */
export const SCHEMA_VERSION = 16

/** A chave da linha do registro — uma só, texto fixo (e não o `id`
 * automático) porque o `saveSchema` precisa ser um upsert determinístico. */
export const SCHEMA_KEY = "content"

/** O que o CRM recebe em `schema`: o "formulário inteiro" — tipos, rótulos,
 * campos por tipo, sub-formulário de item e a aparência usada só para desenhar. */
export type ContentSchemaPayload = {
  /** Os tipos de **conteúdo** que o CRM edita: as seções e o bloco de tema
   * (`CONTENT_TYPES`). O nome `types` vem do registro; a rota valida por aqui. */
  types: readonly string[]
  /** Tipo → nome que o lojista lê (`editorial` se chama "Sobre"). */
  typeLabels: Record<string, string>
  /** Tipo → campos de `data`, na ordem do editor. Inclui o tema (`fields.theme`
   * = `THEME_FIELDS`): a validação e o editor leem daqui. */
  fields: Record<string, readonly FieldSpec[]>
  /** `kind` de lista → campos de dentro do item. */
  itemFields: Partial<Record<string, readonly ItemFieldSpec[]>>
  /** As rotas que a loja **tem** (`CONTENT_DESTINATIONS`), para o `datalist` do
   * campo `kind: "href"`. O storefront ignora esta chave. */
  destinations: readonly ContentDestination[]
  /** As marcas do texto formatado (`MARKDOWN_MARKS`): a barra que o editor
   * desenha acima de toda caixa `markdown`, que não pode divergir do parser
   * da loja. */
  markdownMarks: readonly MarkdownMark[]
  /** Prévia de aparência para o editor: o hex de cada cor e a família/pilha de
   * cada fonte, só para **desenhar** — o gravável vem de `options`. */
  palette: Record<string, string>
  /** Papel da fonte → `{ family, stack }`, para a prévia da fonte. */
  fonts: Record<string, { family: string; stack: string }>
  /** Cores de fundo que o storefront trata como escuras: é o que permite o trilho
   * de fundo **avisar** isso na escolha, em vez de o lojista descobrir na loja. */
  darkTokens: readonly string[]
  /** Tipos que só podem existir uma vez por superfície e que moram numa **casa
   * ancorada**. É decisão de **formulário**: um segundo cabeçalho é recusado. */
  singletonTypes: readonly string[]
  /** As superfícies que o CRM edita — a vitrine e o tema —, com rótulo, título e
   * aviso (`CONTENT_SURFACES`): é o que monta o seletor e o diálogo de cada aba. */
  surfaces: readonly ContentSurfaceSpec[]
}

/** O schema que o CRM consome, e de onde ele veio. `source` é o que diz se o
 * formulário na tela é o gravado (`"db"`) ou o bootstrap (`"contract"`). */
export type StoredSchema = {
  /** O schema que o CRM consome. */
  schema: ContentSchemaPayload
  /** O `schemaVersion` que a loja recebe no payload. */
  version: number
  source: "db" | "contract"
}

/** Uma linha do registro, como o serviço a lê (ou `null`, se não houver). */
export type SchemaRow = {
  version?: number | null
  data?: unknown
} | null

/** **A decisão**: registro gravado ou bootstrap do contrato — função pura, e
 * `types` vazio também conta como "sem registro". */
export function resolveSchema(row: SchemaRow): StoredSchema {
  const stored = row?.data as ContentSchemaPayload | undefined

  if (row && typeof row.version === "number" && stored?.types?.length) {
    return { schema: stored, version: row.version, source: "db" }
  }

  return {
    schema: buildSchema(),
    version: SCHEMA_VERSION,
    source: "contract",
  }
}

/** Monta o schema a partir do contrato — o mesmo contrato produz sempre o
 * mesmo schema, e é por isso que o `--check` do seed-schema pode comparar. */
export function buildSchema(): ContentSchemaPayload {
  return {
    types: CONTENT_TYPES,
    /** Os campos de cada tipo **editável** — as seções e o bloco de tema. O tema
     * entra por aqui porque a validação e o editor são os mesmos. */
    fields: { ...SECTION_FIELDS, [THEME_TYPE]: THEME_FIELDS },
    /** Nome de cada tipo para a listagem (`editorial` se chama "Sobre"). */
    typeLabels: { ...SECTION_TYPE_LABELS, [THEME_TYPE]: THEME_TYPE_LABEL },
    /** Sub-formulário de cada item de lista, por `kind`. */
    itemFields: ITEM_FIELDS,
    /** O índice de destinos (`CONTENT_DESTINATIONS`) para o seletor dos campos
     * `href`: as páginas saem de `PAGE_SURFACES`, a mesma lista do `[slug]`. */
    destinations: CONTENT_DESTINATIONS,
    /** A barra de marcas do texto formatado: o painel desenha o que o registro
     * diz, e a lista não pode divergir da que o parser do storefront importa. */
    markdownMarks: MARKDOWN_MARKS,
    palette: THEME_COLOR_HEXES,
    fonts: THEME_FONTS,
    darkTokens: THEME_DARK_TOKENS,
    /** Os tipos únicos, para o CRM não oferecer um segundo cabeçalho — a lista
     * não pode divergir da regra que a rota aplica. */
    singletonTypes: SINGLETON_SECTION_TYPES,
    /** As superfícies que a tela edita: uma superfície nova (ou um tipo novo
     * numa superfície) aparece no CRM sem edição em React. */
    surfaces: CONTENT_SURFACES,
  }
}
