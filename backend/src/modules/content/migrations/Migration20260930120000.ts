import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * A numeração da home virou **casas**: 1 a 10, com o bloco ancorado parado.
 *
 * Antes desta migration a home era a vitrine numerada (100, 110, 120…) mais o
 * cromo de 1, 2 e 10 — a faixa da vitrine começava depois do cromo, e a capa e
 * a faixa de benefícios ordenavam como qualquer seção. Agora a home inteira cabe
 * em **1 a 10**: a barra de anúncio (1), o cabeçalho (2), a capa (3) e a faixa
 * de benefícios (4) abrem a página, o rodapé a fecha na casa 10, e as seções que
 * o lojista ordena ocupam as casas livres do meio (5…), pulando a do rodapé
 * (`FIXED_SECTION_POSITIONS` e a faixa da superfície, no contrato).
 *
 * **Três `update`, e a ordem deles importa.**
 *
 *   1. `fixed` da capa e da faixa de benefícios: elas passaram a ser fixas
 *      (`SINGLETON_SECTION_TYPES`), e é a coluna que a tela lê para não oferecer
 *      setas. Tem de vir **primeiro**: o passo 3 renumera só quem não é fixo.
 *   2. as casas do bloco ancorado, por tipo.
 *   3. as casas das ordenáveis, na ordem que elas já têm (`position`), a partir
 *      de 5 e pulando a casa 10 — a sexta seção (se a base tiver uma) nasce em
 *      11, nunca em cima do rodapé.
 *
 * Os tipos vêm escritos **aqui**, e não de `SINGLETON_SECTION_TYPES` ou de
 * `FIXED_SECTION_POSITIONS`: uma migration é o que aconteceu nesta data, e ler o
 * contrato de hoje faria o passado mudar quando um tipo novo virasse fixo (ou
 * deixasse de ser) — a mesma razão da migration da coluna `fixed`
 * (`Migration20260929211634`). Quem cria depois disso nasce com a casa certa
 * pela porta que o cria (`restore.ts`, `POST /admin/content`), não por aqui.
 *
 * O `down` desfaz a **regra**, não a ordem que o lojista montou: as duas voltam
 * a ser ordenáveis e a vitrine volta à faixa de 100 em 100 — o estado anterior
 * desta base (1, 2, 10 no cromo e a vitrine na centena) é o que ele devolve, e
 * não uma ordem em particular que existiu algum dia.
 */
export class Migration20260930120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`update "content_section" set "fixed" = true where "surface" = 'home' and "type" in ('hero', 'benefits') and "deleted_at" is null;`);

    this.addSql(`update "content_section" set "position" = case "type" when 'announcement' then 1 when 'nav' then 2 when 'hero' then 3 when 'benefits' then 4 when 'footer' then 10 end where "surface" = 'home' and "type" in ('announcement', 'nav', 'hero', 'benefits', 'footer') and "deleted_at" is null;`);

    this.addSql(`update "content_section" as "s" set "position" = case when 4 + "ranked"."rn" >= 10 then 5 + "ranked"."rn" else 4 + "ranked"."rn" end from (select "id", row_number() over (order by "position" asc, "id" asc) as "rn" from "content_section" where "surface" = 'home' and "deleted_at" is null and "fixed" = false) as "ranked" where "s"."id" = "ranked"."id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`update "content_section" set "fixed" = false where "surface" = 'home' and "type" in ('hero', 'benefits') and "deleted_at" is null;`);

    this.addSql(`update "content_section" as "s" set "position" = 100 + 10 * ("ranked"."rn" - 1) from (select "id", row_number() over (order by "position" asc, "id" asc) as "rn" from "content_section" where "surface" = 'home' and "deleted_at" is null and "fixed" = false) as "ranked" where "s"."id" = "ranked"."id";`);
  }

}
