import { model } from "@medusajs/framework/utils"

/**
 * Seção de conteúdo da vitrine (CMS da Real Valor).
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
 *
 * **A regra da coluna:** aqui só entra o que se **filtra ou ordena**
 * (`surface`, `type`, `enabled`, `position`). Um campo que é só cópia —
 * "Título", "Texto do selo" — vive em `data`, mesmo que pareça um rótulo:
 * era o caso da coluna `title`, removida em 2026-09-29. Ela duplicava o
 * `data.title` de quatro tipos (`collections`, `featured`, `editorial`,
 * `instagram`), o CRM não a mostrava e a loja nunca a leu — duas fontes
 * para a mesma palavra, e a que se editava não era a que se desenhava.
 *
 * **O que aponta para outra tabela não é coluna nem `data`:** a curadoria
 * de produtos de uma seção (`kind: "products"`) é um **link do Medusa**
 * (`src/links/content-section-product.ts`), com a ordem da vitrine na
 * coluna `position` do link. É o `id` de produto como referência de
 * verdade, e não uma lista de ids dentro do JSON — ver `README.md`.
 */
const ContentSection = model.define("content_section", {
  id: model.id().primaryKey(),

  /** `home` por padrão. Permite reaproveitar o módulo noutras páginas. */
  surface: model.text().default("home"),

  /**
   * Tipo da seção: `announcement` | `hero` | `benefits` | `collections`
   * | `featured` | `editorial` | `instagram` | `nav`.
   *
   * Sem `enum` no banco de propósito: o union é validado em TS, e
   * adicionar um tipo novo passa a ser só código — sem migration.
   */
  type: model.text(),

  /** Seções desabilitadas nunca chegam à vitrine. */
  enabled: model.boolean().default(true),

  /** Ordem de renderização, ascendente. */
  position: model.number().default(0),

  /** Payload específico do tipo — ver `contract.ts`. */
  data: model.json(),
})

export default ContentSection
