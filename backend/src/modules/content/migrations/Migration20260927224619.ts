import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260927224619 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "content_schema" ("key" text not null, "version" integer not null, "data" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_schema_pkey" primary key ("key"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_content_schema_deleted_at" ON "content_schema" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_schema" cascade;`);
  }

}
