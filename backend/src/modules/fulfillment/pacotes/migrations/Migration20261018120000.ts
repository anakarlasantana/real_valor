import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/** A tabela `pacote`. O índice parcial garante uma única padrão: duas dariam preço
 * alternando entre consultas. */
export class Migration20261018120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "pacote" ("id" text not null, "nome" text not null, "peso_gramas" integer not null, "altura_cm" integer not null, "largura_cm" integer not null, "comprimento_cm" integer not null, "padrao" boolean not null default false, "ativo" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pacote_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pacote_deleted_at" ON "pacote" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pacote_padrao_unico" ON "pacote" ("padrao") WHERE "padrao" = true AND "deleted_at" IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pacote" cascade;`);
  }

}
