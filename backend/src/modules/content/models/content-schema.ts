import { model } from "@medusajs/framework/utils"

/**
 * O schema do CRM como dado: uma linha, com o formulário inteiro em `data`.
 * -------------------------------------------------------------------------
 * Por que uma tabela só, e não mais colunas: o schema é **heterogêneo e
 * versionado** — tipos, campos por tipo, rótulos, opções, grupos, ícones. Uma
 * coluna por chave do schema envelheceria a cada campo novo (migration a cada
 * campo), que é exatamente o custo que o registro em `data` remove: campo novo
 * é dado novo, não coluna nova.
 *
 * Por que uma tabela **própria**, e não um `content_block` com
 * `surface: "schema"`: `content_block` é conteúdo versionado por seção, com
 * histórico e ordem de render. O schema é a **descrição** do formulário — não
 * tem posição na home, não é renderizado, e sua história é a coluna `version`.
 * Misturá-los obrigaria a mesma linha a significar duas coisas com ciclos de
 * vida diferentes.
 *
 * A linha nasce pelo `seed-schema` (`SCHEMA_KEY`), não pela migration: a
 * migration fica só com o DDL, e assim continua sendo histórico determinístico
 * (o conteúdo da linha é derivado de código, não de snapshot).
 *
 * Isto NÃO afrouxa a tipagem: `data` é validado contra o contrato no
 * `seed-schema` (na escrita) e no `--check` (na leitura), e a API valida o
 * que o CRM grava contra **esta** linha.
 */
const ContentSchema = model.define("content_schema", {
  /** Chave fixa da linha do schema ("content"). Ver `SCHEMA_KEY`. */
  key: model.text().primaryKey(),

  /**
   * O `schemaVersion` que a loja recebe no payload.
   *
   * Carimbado a partir de `SCHEMA_VERSION` (no contrato) no momento da
   * gravação: é o que permite à loja saber com qual schema os dados foram
   * escritos, e ao `--check` dizer que o registro está velho.
   */
  version: model.number(),

  /** O schema: tipos, rótulos, campos, itemFields, paleta, fontes, darkTokens. */
  data: model.json(),
})

export default ContentSchema
