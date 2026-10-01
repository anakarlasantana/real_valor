import { model } from "@medusajs/framework/utils"

/**
 * Seção de conteúdo da vitrine (CMS da Real Valor).
 *
 * Um registro = uma seção renderizada na home (ou em qualquer outra
 * superfície, via `surface`).
 *
 * Por que uma tabela só, com `data` em JSON, em vez de uma tabela por
 * tipo de seção? Porque a árvore de conteúdo é heterogênea e cada tipo
 * tem um formulário próprio: `hero` tem a lista de slides,
 * `benefits` tem uma lista de itens, `instagram` tem uma lista de
 * imagens. Um schema relacional daria 7 tabelas + 7 migrations e o
 * admin teria 7 telas. Aqui as colunas que se filtram/ordenam ficam
 * indexadas e o resto — que é só payload — vive em `data`.
 *
 * Isto NÃO afrouxa a tipagem: `data` é validado contra o contrato em
 * `src/modules/content/contract.ts` na entrada e na saída da API.
 *
 * **A regra da coluna:** aqui só entra o que se **filtra, ordena ou decide na
 * tela** (`surface`, `type`, `enabled`, `position`, `fixed`). Um campo que é só
 * cópia —
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

  /**
   * A seção é **fixa**: ela não tem ordem.
   *
   * É o cromo do site — barra de anúncio, cabeçalho e rodapé
   * (`SINGLETON_SECTION_TYPES`, no contrato) —, que a moldura da loja desenha em
   * todas as rotas. A loja resolve os três por `type`, nunca por `position`:
   * mover o cabeçalho na lista do CRM não moveria nada no site.
   *
   * A coluna é o que o CRM lê para decidir o que a lista mostra: numa seção
   * fixa, o lugar do numeral é a etiqueta **Fixo** e as setas de mover não
   * existem — oferecer o movimento prometeria o que a vitrine não faz. Quem
   * grava a coluna são as duas portas que criam seção (o seed/`Restaurar padrão`
   * e o `POST /admin/content`), sempre a partir do tipo: `type` diz quem é
   * cromo, a linha guarda a resposta.
   *
   * Por que não derivar do tipo na hora de desenhar? Porque aí a resposta viveria
   * no código e a lista seria uma adivinhação sobre dados antigos; na linha, ela
   * é o que está gravado — e a migration que criou a coluna já marcou o cromo que
   * existia.
   */
  fixed: model.boolean().default(false),

  /** Payload específico do tipo — ver `contract.ts`. */
  data: model.json(),
})

export default ContentSection
