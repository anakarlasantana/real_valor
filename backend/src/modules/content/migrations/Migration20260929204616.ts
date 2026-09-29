import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * O rename do módulo de conteúdo: os nomes das tabelas passam a ser os da
 * linguagem de domínio do módulo (`content_section`, `content_contract`), e a
 * coluna morta `title` sai.
 *
 * **Por que à mão, e não pelo `db:generate`.** O gerador compara os models com
 * o `.snapshot-content.json`; como os dois models mudaram de nome, ele emite
 * `create table "content_section"` + `drop table "content_block" cascade` — que
 * numa base com dados é **perda de conteúdo** (a vitrine montada e o que o
 * lojista editou). Aqui a operação é `rename`: a tabela é a mesma, com outro
 * nome, e as linhas continuam onde estão. O snapshot é regerado (o alvo tem de
 * casar com os models, senão o próximo `db:generate` volta a emitir create+drop),
 * mas a migration que leva o banco até lá é esta.
 *
 * **Os nomes.** `content_block` virou `content_section` porque é isso que a
 * linha é — uma seção da vitrine, com posição e visibilidade, e não um "bloco"
 * genérico de CMS. `content_schema` virou `content_contract` porque o que a
 * linha guarda é o contrato entre o CRM e a loja; `schema` continuou sendo o
 * nome do **dado** que ela carrega (o payload que a loja lê tem `schema` e
 * `schemaVersion`). Ver `models/content-contract.ts`.
 *
 * **O `title` sai.** Era coluna de rótulo da listagem **e** campo de conteúdo em
 * quatro tipos; o CRM não a mostrava e a loja nunca a leu. Quem editava
 * "Título" gravava na coluna, recebia 200 e via a vitrine intacta — o
 * `data.title` é que é desenhado. Ver `models/content-section.ts`.
 *
 * Índices e constraint também são renomeados: `content_block_pkey`,
 * `IDX_content_block_deleted_at` e os equivalentes do schema. O Medusa não os
 * conhece por nome (o índice parcial `WHERE deleted_at IS NULL` nem é gerado
 * por ele — foi escrito à mão), mas deixar o nome da tabela antiga no `\d` é
 * exatamente o tipo de resíduo que faz a próxima pessoa procurar uma tabela que
 * não existe mais.
 */
export class Migration20260929204616 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "content_block" rename to "content_section";`);
    this.addSql(`alter index "content_block_pkey" rename to "content_section_pkey";`);
    this.addSql(`alter index "IDX_content_block_deleted_at" rename to "IDX_content_section_deleted_at";`);
    this.addSql(`alter table "content_section" drop column if exists "title";`);

    this.addSql(`alter table "content_schema" rename to "content_contract";`);
    this.addSql(`alter index "content_schema_pkey" rename to "content_contract_pkey";`);
    this.addSql(`alter index "IDX_content_schema_deleted_at" rename to "IDX_content_contract_deleted_at";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter index "IDX_content_contract_deleted_at" rename to "IDX_content_schema_deleted_at";`);
    this.addSql(`alter index "content_contract_pkey" rename to "content_schema_pkey";`);
    this.addSql(`alter table "content_contract" rename to "content_schema";`);

    // O `down` devolve o **formato**, não o dado: o `title` volta vazio (uma
    // coluna descartada não tem de onde ser recuperada, e ela nunca foi lida
    // por ninguém). Sem ele, um `db:generate` depois de um rollback acusaria
    // divergência entre o banco e o model antigo.
    this.addSql(`alter table "content_section" add column if not exists "title" text null;`);
    this.addSql(`alter index "IDX_content_section_deleted_at" rename to "IDX_content_block_deleted_at";`);
    this.addSql(`alter index "content_section_pkey" rename to "content_block_pkey";`);
    this.addSql(`alter table "content_section" rename to "content_block";`);
  }

}
