import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import ContentModule from "../modules/content"

/**
 * A curadoria de produtos de uma seção da vitrine (o `kind: "products"`): a
 * **referência** ao catálogo, não cópia no `data` — lista de ids no JSON
 * viraria buraco silencioso na vitrine no primeiro produto apagado. Aqui é o
 * **link** do Medusa: tabela criada e versionada por ele, `query.graph`
 * atravessa, `remoteLink` lê e escreve, e o link morre com um dos lados.
 *
 * `position` é a coluna extra do link, o análogo do `content_section.position`:
 * a ordem é **da curadoria**, e não do produto (o mesmo produto pode ser 1º
 * numa seção e 5º na outra). O `remoteLink.create` é um upsert — é assim que a
 * reordenação entra (ver `writeCuration`, em `modules/content/curation.ts`).
 *
 * `isList: true` nos dois lados é obrigatório: sem ele o `remoteLink.create`
 * recusa o segundo vínculo. A tabela gerada **não** tem FK — a integridade é de
 * aplicação —, e a única unicidade é a chave primária do par
 * `(product_id, content_section_id)`.
 */
export default defineLink(
  // O lado do catálogo: `linkable.product` do módulo de produto — o caminho que
  // o público usa (`@medusajs/medusa/product`), não a dependência transitiva.
  { linkable: ProductModule.linkable.product, isList: true },
  { linkable: ContentModule.linkable.contentSection, isList: true },
  {
    database: {
      // Nome explícito (o default seria `product_content`, composto dos dois
      // módulos): diz o que a linha é — uma seção **com** produtos.
      table: "content_section_product",
      idPrefix: "csp",
      extraColumns: {
        // Mesma palavra da seção, não o `rank` do `image.rank`.
        position: { type: "integer", defaultValue: "0" },
      },
    },
  }
)