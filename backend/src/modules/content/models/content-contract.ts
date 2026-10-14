import { model } from "@medusajs/framework/utils"

/**
 * O contrato do conteúdo como **registro**: uma linha, com o formulário inteiro
 * em `data`.
 *
 * O nome: a tabela guarda o **contrato** — o acordo entre o CRM e a loja sobre a
 * forma do conteúdo, o mesmo papel de `contract.ts`; o *conteúdo* da linha segue
 * sendo o **schema** (`ContentSchemaPayload`, `SCHEMA_VERSION`,
 * `service.getContract()`). **Contrato** é o registro, **schema** é o dado — e o
 * nome `draft` fica guardado para o rascunho por seção, que é outra coisa.
 *
 * Uma tabela só, com `data` em JSON, e não mais colunas: o contrato é heterogêneo
 * e versionado (tipos, campos por tipo, rótulos, opções, grupos, ícones) e uma
 * coluna por chave pediria migration a cada campo novo. Própria, e não uma
 * `content_section` com `surface: "contract"`: a seção é conteúdo versionado com
 * ordem de render; o contrato é a **descrição** do formulário — não tem posição,
 * não é renderizado, e sua história é a coluna `version`.
 *
 * A linha nasce pelo `seed-schema` (`SCHEMA_KEY`), não pela migration (que fica só
 * com o DDL): o conteúdo é derivado de código, não de snapshot. A tipagem não
 * afrouxa — `data` é validado contra o contrato na escrita e no `--check`.
 */
const ContentContract = model.define("content_contract", {
  /** Chave fixa da linha do schema ("content"). Ver `SCHEMA_KEY`. */
  key: model.text().primaryKey(),

  /**
   * O `schemaVersion` que a loja recebe: carimbado de `SCHEMA_VERSION` na
   * gravação. É o que diz à loja com que schema os dados foram escritos e ao
   * `--check` que o registro está velho.
   */
  version: model.number(),

  /** O schema: tipos, rótulos, campos, itemFields, paleta, fontes, darkTokens. */
  data: model.json(),
})

export default ContentContract
