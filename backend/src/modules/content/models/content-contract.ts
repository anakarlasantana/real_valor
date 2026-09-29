import { model } from "@medusajs/framework/utils"

/**
 * O contrato do conteúdo como **registro**: uma linha, com o formulário
 * inteiro em `data`.
 * -------------------------------------------------------------------------
 * **O nome.** A tabela se chama `content_contract` porque o que ela guarda é
 * o **contrato** — o acordo entre o CRM e a loja sobre a forma do conteúdo, o
 * mesmo papel de `contract.ts`. O *conteúdo* da linha continua sendo chamado
 * de **schema** (`ContentSchemaPayload`, `SCHEMA_VERSION`, `service.getContract()`
 * devolvendo `StoredSchema`, o payload com `schema`/`schemaVersion`): é o nome
 * que a loja e o painel já usam, e renomeá-lo seria mexer no payload por
 * vocabulário. O par é este — **contrato** é o registro, **schema** é o dado.
 *
 * **Por que `content_contract` e não `content_draft`:** a versão anterior
 * cogitou `draft` para o rascunho de pré-visualização, que é um estado
 * *temporário* de uma seção. O contrato é permanente e é outra coisa; guardar
 * o nome `draft` para quando o rascunho por seção existir evita que a mesma
 * palavra signifique duas coisas no banco.
 *
 * **Por que uma tabela só, e não mais colunas:** o contrato é **heterogêneo e
 * versionado** — tipos, campos por tipo, rótulos, opções, grupos, ícones. Uma
 * coluna por chave envelheceria a cada campo novo (migration a cada campo), que
 * é exatamente o custo que o registro em `data` remove: campo novo é dado novo,
 * não coluna nova.
 *
 * **Por que uma tabela própria**, e não uma `content_section` com
 * `surface: "contract"`: a seção é conteúdo versionado por seção, com ordem de
 * render; o contrato é a **descrição** do formulário — não tem posição na home,
 * não é renderizado, e sua história é a coluna `version`. Misturá-los obrigaria
 * a mesma linha a significar duas coisas com ciclos de vida diferentes.
 *
 * A linha nasce pelo `seed-schema` (`SCHEMA_KEY`), não pela migration: a
 * migration fica só com o DDL, e assim continua sendo histórico determinístico
 * (o conteúdo da linha é derivado de código, não de snapshot).
 *
 * Isto NÃO afrouxa a tipagem: `data` é validado contra o contrato no
 * `seed-schema` (na escrita) e no `--check` (na leitura), e a API valida o
 * que o CRM grava contra **esta** linha.
 */
const ContentContract = model.define("content_contract", {
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

export default ContentContract
