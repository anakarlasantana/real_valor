import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260924231335 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "content_block" ("id" text not null, "surface" text not null default 'home', "type" text not null, "title" text null, "enabled" boolean not null default true, "position" integer not null default 0, "data" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_block_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_content_block_deleted_at" ON "content_block" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_block" cascade;`);
  }

}
