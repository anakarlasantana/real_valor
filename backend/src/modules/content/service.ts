import { MedusaService } from "@medusajs/framework/utils"

import ContentBlock from "./models/content-block"
import ContentSchemaModel from "./models/content-schema"
import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  buildSchema,
  resolveSchema,
  type ContentSchemaPayload,
  type StoredSchema,
} from "./schema"

/**
 * O schema do CRM, e de onde ele veio.
 *
 * `source` existe para o payload dizer a verdade: `"db"` é o registro no
 * Postgres (o caso normal depois do `make seed`), `"contract"` é o fallback —
 * o schema montado de `contract.ts`, para um banco novo ainda sem a linha. Não
 * é depuração: é o que permite a UI e a auditoria saberem se o formulário que
 * estão vendo é o gravado ou o de bootstrap.
 */


/**
 * Serviço do módulo de conteúdo.
 *
 * Além dos métodos gerados (`listContentBlocks`, `retrieveContentBlock`,
 * `createContentBlocks`, `updateContentBlocks`, `deleteContentBlocks`,
 * `listContentSchemas`…), expõe:
 *
 * - `listSections` — as seções já no formato do contrato, com `data` desaninhado
 *   no nível raiz. É o que as duas rotas de API usam, para que achatamento e
 *   normalização fiquem num lugar só;
 * - `getSchema`/`saveSchema` — o schema do CRM: **do banco**, com o contrato
 *   como bootstrap/fallback (`schema.ts` monta, `seed-schema` grava).
 */
class ContentModuleService extends MedusaService({
  ContentBlock,
  ContentSchema: ContentSchemaModel,
}) {
  /**
   * Lista as seções de uma superfície, ordenadas e achatadas.
   *
   * @param surface  `home` por padrão.
   * @param onlyEnabled  Quando true, filtra as desabilitadas no banco.
   */
  async listSections({
    surface = "home",
    onlyEnabled = false,
  }: { surface?: string; onlyEnabled?: boolean } = {}) {
    const blocks = await this.listContentBlocks(
      {
        surface,
        ...(onlyEnabled ? { enabled: true } : {}),
      },
      { order: { position: "ASC" } }
    )

    return blocks.map((block) => ({
      id: block.id,
      enabled: block.enabled,
      position: block.position,
      type: block.type,
      ...(block.data ?? {}),
    }))
  }

  /**
   * O schema do CRM: do Postgres, com o contrato como fallback.
   *
   * O registro é a fonte — o `contract.ts` é o bootstrap. O fallback existe
   * para o banco novo (ou a base limpa) não derrubar o painel: sem a linha, o
   * schema é montado do contrato e o payload diz `source: "contract"`, o que
   * torna visível que o registro ainda não foi gravado.
   *
   * `types` vazio também conta como "sem registro": uma linha em branco
   * (criada à mão, ou por um seed antigo) serviria um formulário vazio para o
   * CRM, que é pior do que servir o contrato.
   */
  async getSchema(): Promise<StoredSchema> {
    // A regra ("registro ou bootstrap?") está em `resolveSchema`, no
    // `schema.ts`: é pura e testável sem container. Aqui é só a leitura.
    const [row] = await this.listContentSchemas({ key: SCHEMA_KEY })

    return resolveSchema(row)
  }

  /**
   * Grava (ou regrava) o schema a partir do contrato.
   *
   * Idempotente de propósito: é a mesma linha (`SCHEMA_KEY`) reescrita com a
   * versão carimbada, então rodar o `seed-schema` mil vezes deixa o banco num
   * estado só. `version` e `schema` aceitam override para o `--check` não
   * precisar montar o schema duas vezes.
   */
  async saveSchema({
    schema = buildSchema(),
    version = SCHEMA_VERSION,
  }: { schema?: ContentSchemaPayload; version?: number } = {}): Promise<void> {
    const row = {
      key: SCHEMA_KEY,
      version,
      data: schema as unknown as Record<string, unknown>,
    }
    // `MedusaService` não gera `upsert*` para model com chave própria, então o
    // "upsert" é este `if`: a linha existe → reescreve; não existe → cria. Como
    // a chave é fixa (`SCHEMA_KEY`), nunca nascem duas linhas em disputa.
    // `take` é opção da query, não filtro: vai no segundo argumento, como em
    // `listSections` — no primeiro ele vira coluna e o MikroORM reprova com
    // "Trying to query by not existing property ContentSchema.take".
    const [existing] = await this.listContentSchemas(
      { key: SCHEMA_KEY },
      { take: 1 }
    )

    if (existing) {
      await this.updateContentSchemas(row)
      return
    }

    await this.createContentSchemas(row)
  }
}

export default ContentModuleService
