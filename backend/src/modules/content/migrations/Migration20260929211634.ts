import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * A coluna `fixed` da seção: a seção **não tem ordem**.
 *
 * É o cromo do site — barra de anúncio, cabeçalho e rodapé —, que a moldura da
 * loja desenha em todas as rotas e resolve por `type`, nunca por `position`. A
 * coluna é o que o CRM lê para decidir o que a lista mostra: na seção fixa, o
 * lugar do numeral é a etiqueta **Fixo** e as setas de mover não existem. Ver
 * `models/content-section.ts` para a regra e `order.ts` para a faixa de posições.
 *
 * **O `add column` é gerado; o `update` é à mão.** O gerador emite DDL e não tem
 * como saber que as linhas que **já existem** são o cromo: com o corpo só do
 * `db:generate`, as três seções de hoje ficariam em `fixed = false` e o CRM
 * passaria a mostrar numeral e setas para o cabeçalho — exatamente o movimento
 * que a loja não faz. O `update` marca o que existe; numa base nova ele não acha
 * ninguém (o seed roda depois das migrations) e quem responde é o contrato: o
 * seed/`Restaurar padrão` e o `POST /admin/content` gravam a coluna a partir do
 * tipo.
 *
 * Os três tipos vêm escritos **aqui**, e não de `SINGLETON_SECTION_TYPES`: uma
 * migration é o que aconteceu nesta data, e ler o contrato de hoje faria o
 * passado mudar quando um tipo novo virasse único (ou deixasse de ser). O tipo
 * único criado depois nasce fixo pela porta que o cria, não por esta migration.
 */
export class Migration20260929211634 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "content_section" add column if not exists "fixed" boolean not null default false;`);

    this.addSql(`update "content_section" set "fixed" = true where "type" in ('announcement', 'nav', 'footer');`);
  }

  override async down(): Promise<void> {
    // O `down` devolve o **formato**: a coluna sai e o dado dela sai junto — o
    // inverso de um backfill é a coluna que o guardava. Não há o que desfazer
    // linha a linha, e aplicar o `up` de novo remarca o cromo que existir.
    this.addSql(`alter table if exists "content_section" drop column if exists "fixed";`);
  }

}
