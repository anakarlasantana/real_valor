import { model } from "@medusajs/framework/utils"

/**
 * Seção de conteúdo da vitrine (CMS): um registro = uma seção numa superfície
 * (`surface`, `home` por padrão).
 *
 * Tabela só, com `data` em JSON, e não uma por tipo: a árvore é heterogênea (`hero`
 * tem slides, `benefits` tem itens) e o relacional daria 7 tabelas + 7 migrations.
 * Aqui só o que se **filtra, ordena ou decide na tela** vira coluna; campo que é só
 * cópia vive em `data` — a coluna `title` (removida em 2026-09-29) duplicava o
 * `data.title` de quatro tipos e a loja nunca a leu: duas fontes para a mesma
 * palavra. O que aponta para outra tabela é **link, não coluna**
 * (`src/links/content-section-product.ts`). `data` é validado contra o contrato na
 * entrada e na saída da API.
 */
const ContentSection = model.define("content_section", {
  id: model.id().primaryKey(),

  /** `home` por padrão. Permite reaproveitar o módulo noutras páginas. */
  surface: model.text().default("home"),

  /**
   * Tipo da seção: `announcement` | `hero` | `benefits` | `collections`
   * | `featured` | `editorial` | `instagram` | `nav`. Sem `enum` no banco de
   * propósito: o union é validado em TS e um tipo novo é só código, sem migration.
   */
  type: model.text(),

  /** Seções desabilitadas nunca chegam à vitrine. */
  enabled: model.boolean().default(true),

  /** Ordem de renderização, ascendente. */
  position: model.number().default(0),

  /**
   * A seção é **fixa**: o cromo do site — barra de anúncio, cabeçalho e rodapé
   * (`SINGLETON_SECTION_TYPES`) —, que a moldura desenha em todas as rotas e que a
   * loja resolve por `type`, nunca por `position`: mover o cabeçalho na lista do CRM
   * não moveria nada no site. O CRM lê a coluna para mostrar a etiqueta **Fixo** em
   * vez das setas (oferecer o movimento prometeria o que a vitrine não faz), e quem
   * grava são as duas portas que criam seção, sempre a partir do tipo. Derivar na
   * hora de desenhar faria a resposta viver no código, e a lista seria adivinhação
   * sobre dados antigos: a coluna é o que está gravado.
   */
  fixed: model.boolean().default(false),

  /** Payload específico do tipo — ver `contract.ts`. */
  data: model.json(),
})

export default ContentSection
