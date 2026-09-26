import { model } from "@medusajs/framework/utils"

/**
 * Bloco de conteúdo da vitrine (CMS da Real Valor).
 *
 * Um registro = uma seção renderizada na home (ou em qualquer outra
 * superfície, via `surface`).
 *
 * Por que uma tabela só, com `data` em JSON, em vez de uma tabela por
 * tipo de seção? Porque a árvore de conteúdo é heterogênea e cada tipo
 * tem um formulário próprio: `hero` tem `headlineEmphasis` + `overlay`,
 * `benefits` tem uma lista de itens, `instagram` tem uma lista de
 * imagens. Um schema relacional daria 7 tabelas + 7 migrations e o
 * admin teria 7 telas. Aqui as colunas que se filtram/ordenam ficam
 * indexadas e o resto — que é só payload — vive em `data`.
 *
 * Isto NÃO afrouxa a tipagem: `data` é validado contra o contrato em
 * `src/modules/content/contract.ts` na entrada e na saída da API.
 */
const ContentBlock = model.define("content_block", {
  id: model.id().primaryKey(),

  /** `home` por padrão. Permite reaproveitar o módulo noutras páginas. */
  surface: model.text().default("home"),

  /**
   * Tipo da seção: `announcement` | `hero` | `benefits` | `collections`
   * | `featured` | `editorial` | `instagram`.
   *
   * Sem `enum` no banco de propósito: o union é validado em TS, e
   * adicionar um tipo novo passa a ser só código — sem migration.
   */
  type: model.text(),

  /** Rótulo humano, mostrado na listagem do admin. */
  title: model.text().nullable(),

  /** Seções desabilitadas nunca chegam à vitrine. */
  enabled: model.boolean().default(true),

  /** Ordem de renderização, ascendente. */
  position: model.number().default(0),

  /** Payload específico do tipo — ver `contract.ts`. */
  data: model.json(),
})

export default ContentBlock
