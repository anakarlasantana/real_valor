import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import ContentModule from "../modules/content"

/**
 * A curadoria de produtos de uma seção da vitrine (o `kind: "products"`).
 * -------------------------------------------------------------------------
 * O CMS tem duas relações que parecem a mesma coisa e não são:
 *
 *   seção → catálogo   **referência** (quais produtos, em que ordem);
 *   seção → texto      **cópia** (`data`: `title`, `eyebrow`, `viewAllHref`…).
 *
 * A curadoria é a primeira. Escrevê-la como lista de ids dentro do `data`
 * funcionaria até o primeiro produto apagado: um `id` que não existe mais
 * viraria um buraco silencioso na vitrine, e nada no banco saberia que a
 * referência morreu. Aqui é o **link** do Medusa — a mesma máquina que liga
 * variante × estoque e produto × canal de venda —, com a ordem da vitrine numa
 * coluna de verdade (`position`), e não dentro do JSON.
 *
 * **Por que o link, e não uma tabela nossa com FK.** É o caminho do framework
 * para ligar dois módulos: `query.graph` atravessa, `remoteLink` lê e escreve, a
 * tabela é criada e versionada pelo módulo de links (aparece em
 * `link_module_migrations`), e o Medusa já limpa o link quando **um dos dois**
 * lados é removido (`removeRemoteLinkStep` → `Link.delete` → cascade, soft, pelas
 * `extends` deste arquivo). Uma tabela escrita à mão teria a FK, é verdade — mas
 * as outras quatro coisas ficariam por nossa conta.
 *
 * **O que a FK não dá, e o que isso custa.** A tabela gerada **não** tem
 * `references` (conferido no `\d` de `product_variant_inventory_item`, que é a
 * tabela de link do próprio Medusa): a integridade é de aplicação. As duas
 * pontas que a API cobre: `DELETE /admin/content` desvincula a curadoria da
 * seção antes de apagá-la, e apagar um produto pelo admin limpa os links dele
 * pelo workflow do Medusa (`removeRemoteLinkStep`). O buraco que sobra é um
 * `DELETE` cru no psql, por fora da API: a linha do link fica **ativa** apontando
 * para um produto que não existe (tirar vínculo é sempre soft delete — `dismiss`
 * marca `deleted_at`, e o cascade do `Link.delete` usa o mesmo caminho). É o
 * trade-off que o Medusa escolheu, e o preço de não manter o link na mão é ter
 * as quatro coisas acima por nossa conta.
 *
 * **`isList: true` nos dois lados, e por que é obrigatório.** Sem ele o próprio
 * `remoteLink.create` recusa o segundo vínculo: quando um lado não é lista, o
 * Medusa valida unicidade (`Link.create`, "Cannot create multiple links between
 * product and content"). Aqui os dois lados são lista — uma seção tem muitos
 * produtos, e um produto pode estar em mais de uma seção (curadoria do
 * "Destaques" **e** do trilho de lançamentos) —, então a única unicidade que
 * sobra é a chave primária da tabela, o par `(product_id, content_section_id)`.
 *
 * `position` é a coluna extra do link, e é o análogo do `content_section.position`:
 * a ordem é **da curadoria**, e não do produto (o mesmo produto pode estar em
 * 1º numa seção e em 5º na outra). O `remoteLink.create` é um upsert — é assim
 * que a reordenação entra (ver `writeCuration`, em `modules/content/curation.ts`).
 */
export default defineLink(
  // O lado do catálogo: `linkable.product` do módulo de produto (o mesmo
  // caminho que o público — `@medusajs/medusa/product`), e não o pacote
  // `@medusajs/product`, que é dependência transitiva do Medusa — depender
  // dela aqui seria depender de algo que ninguém declarou.
  { linkable: ProductModule.linkable.product, isList: true },
  { linkable: ContentModule.linkable.contentSection, isList: true },
  {
    database: {
      // O nome é explícito porque o default do Medusa seria `product_content`
      // (composto dos dois módulos, na ordem em que são declarados): o nome
      // escolhido diz o que a linha é — uma seção **com** produtos.
      table: "content_section_product",
      idPrefix: "csp",
      extraColumns: {
        // `position` (e não `rank`, a palavra do `image.rank` do Medusa) para
        // não ter dois vocabulários para a mesma ideia: a seção tem
        // `position`, o item da curadoria também.
        position: { type: "integer", defaultValue: "0" },
      },
    },
  }
)