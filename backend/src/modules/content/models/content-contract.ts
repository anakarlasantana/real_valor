import { model } from "@medusajs/framework/utils"

/**
 * O contrato do conteúdo como **registro**: uma linha, com o formulário inteiro
 * em `data`.
 *
 * **Contrato** é o registro, **schema** é o dado (o nome `draft` fica para o
 * rascunho por seção). Uma tabela com `data` em JSON, e não uma coluna por
 * chave: o contrato é heterogêneo e versionado, e cada campo novo pediria
 * migration.
 *
 * A linha nasce pelo `seed-schema` (`SCHEMA_KEY`), não pela migration (que fica
 * só com o DDL): o conteúdo é derivado de código, não de snapshot.
 */
const ContentContract = model.define("content_contract", {
  /** Chave fixa da linha do schema ("content"). Ver `SCHEMA_KEY`. */
  key: model.text().primaryKey(),

  /** O `schemaVersion` carimbado de `SCHEMA_VERSION` na gravação. */
  version: model.number(),

  /** O schema: tipos, rótulos, campos, itemFields, paleta, fontes. */
  data: model.json(),
})

export default ContentContract
