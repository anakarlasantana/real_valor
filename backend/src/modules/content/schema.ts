/**
 * O schema do CRM: o que o formulário é, em um único objeto.
 * -------------------------------------------------------------------------
 * **Por que um arquivo só para isto.** O payload do `GET /admin/content` é
 * montado num lugar só — aqui — porque **duas** pontas precisam dele: a rota
 * que devolve e o `seed-schema` que grava no banco. Quando a montagem estava
 * escrita dentro da rota, o seed teria que repetir a lista de chaves, e as
 * duas pontas divergiriam sem ninguém perceber (é a mesma classe de defeito
 * dos espelhos que a guarda de paridade caça nos dois apps).
 *
 * **O contrato é bootstrap; o banco é a fonte.** Este arquivo monta o schema a
 * partir de `contract.ts`, e `service.getSchema()` prefere o registro gravado
 * no Postgres, caindo aqui só quando a linha não existe (ou quando o schema
 * gravado está vazio). Ver `service.ts`.
 */
import {
  ITEM_FIELDS,
  SECTION_FIELDS,
  SECTION_TYPE_LABELS,
  SECTION_TYPES,
  THEME_COLOR_HEXES,
  THEME_DARK_TOKENS,
  THEME_FONTS,
  type FieldSpec,
  type ItemFieldSpec,
  type SectionType,
} from "./contract"

/**
 * A versão do schema: o `schemaVersion` que a loja recebe no payload.
 *
 * Mora **no contrato**, e não no banco, por um motivo: se a versão derivasse
 * do registro, ninguém veria a divergência entre o schema que gravou os dados
 * e o schema que está no código. Aqui ela é carimbada na escrita
 * (`seed-schema`), o que faz "mudei o contrato e não atualizei o registro"
 * aparecer como diff — e é o que o `--check` do seed-schema acusa.
 *
 * Sobe quando o **formato** do schema muda de um jeito que o CRM/storefront
 * precisam notar: chave nova, campo removido, tipo novo. Não precisa subir
 * para ajuste de rótulo ou texto de `help` — é o mesmo formato.
 */
export const SCHEMA_VERSION = 1

/**
 * O que o CRM recebe em `schema`.
 *
 * É o "formulário inteiro": tipos, rótulos, campos por tipo, sub-formulário
 * de item, e a paleta/fontes/dark-tokens que o editor usa só para **desenhar**
 * (o que pode ser gravado continua vindo de `options`, campo a campo).
 */
export type ContentSchema = {
  /** Tipos de seção que existem. */
  types: readonly SectionType[]
  /** Tipo → nome que o lojista lê (`editorial` se chama "Sobre"). */
  typeLabels: Record<string, string>
  /** Tipo → campos de `data`, na ordem em que o editor os mostra. */
  fields: Record<string, readonly FieldSpec[]>
  /** `kind` de lista → campos de dentro do item. */
  itemFields: Partial<Record<string, readonly ItemFieldSpec[]>>
  /**
   * Prévia de aparência para o editor: o hex de cada cor da paleta e a
   * família/pilha de cada papel de fonte.
   *
   * Vão no `schema`, e não numa terceira cópia dentro do admin, porque o
   * painel é um pacote separado (não importa o contrato) e precisa dos dois só
   * para **desenhar**: a bolinha de cor e a lista de fontes com prévia —
   * nenhuma fonte existe no navegador do painel. O que pode ser gravado
   * continua vindo de `options`, campo a campo, validado no `validateData`
   * da rota admin.
   */
  palette: Record<string, string>
  /** Papel da fonte → `{ family, stack }`, para a prévia da fonte. */
  fonts: Record<string, { family: string; stack: string }>
  /**
   * Cores de fundo que o storefront trata como escuras (lá ele legibiliza o
   * texto em off white). Aqui é o que permite o trilho de fundo **avisar** isso
   * na hora da escolha, em vez de o lojista descobrir depois, olhando a loja.
   */
  darkTokens: readonly string[]
}

/**
 * Monta o schema a partir do contrato.
 *
 * Chamado pelo `seed-schema` (para gravar) e pelo `service.getSchema()`
 * (como fallback quando o banco ainda não tem a linha). Por isso é uma função
 * pura: o mesmo contrato sempre produz o mesmo schema, e o `--check` pode
 * comparar com o que está gravado sem medo de efeito colateral.
 */
export function buildSchema(): ContentSchema {
  return {
    types: SECTION_TYPES,
    fields: SECTION_FIELDS,
    /**
     * Nome de cada tipo para a listagem. Vem daqui como os campos: o `type` é
     * o identificador que o storefront casa no `switch`, e o rótulo é o que o
     * lojista lê — `editorial` se chama "Sobre" porque é esse o nome da âncora
     * no menu. Sem o rótulo no payload o admin teria que manter a tabela (e um
     * tipo novo apareceria como jargão até alguém lembrar de mexer no painel).
     */
    typeLabels: SECTION_TYPE_LABELS,
    /**
     * Sub-formulário de cada item de lista, por `kind`. É o mesmo motivo dos
     * campos: os itens (`benefit.title`, `column.source`…) são objetos e o
     * editor precisa saber o que desenhar dentro de um deles, com as opções e
     * a tradução. Como `fields`, isto é o que o editor **desenha** na tela — o
     * que ele pode gravar continua sendo validado pelo `validateData` da rota.
     */
    itemFields: ITEM_FIELDS,
    palette: THEME_COLOR_HEXES,
    fonts: THEME_FONTS,
    darkTokens: THEME_DARK_TOKENS,
  }
}
