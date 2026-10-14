import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import ContentModule from "../modules/content"

/**
 * Os chips de filtro de uma seção da vitrine (o campo `filters` do `featured`):
 * mesma família da curadoria (`content-section-product.ts`) — a **referência**
 * ao catálogo, não cópia no `data`. O chip era uma lista de rótulos no `data`,
 * mandada como busca textual (`q=Blazers`); medido no banco real, "Blazers" não
 * existia no catálogo e o chip devolvia zero peças **em silêncio**.
 *
 * O chip "Todos" **não** entra: não é categoria, é o gesto de limpar o filtro
 * (antes a posição `filters[0]` dizia qual chip limpava). `position` é a coluna
 * extra — a ordem é **dos chips** —, e a reordenação entra pelo upsert do
 * `remoteLink.create` (ver `writeFilters`, `modules/content/filters.ts`).
 *
 * `isList: true` nos dois lados (sem ele o `remoteLink.create` recusa o segundo
 * vínculo); a tabela **não** tem FK, e um id inexistente é recusado por
 * `resolveCategoryIds`, na rota admin.
 */
export default defineLink(
  // O lado do catálogo primeiro: `defineLink` compõe o nome da entidade
  // (`product_category` + `content_section`) — é o `FILTERS_ENTITY` de
  // `modules/content/filters.ts`: trocar a ordem deixaria a leitura vazia.
  { linkable: ProductModule.linkable.productCategory, isList: true },
  { linkable: ContentModule.linkable.contentSection, isList: true },
  {
    database: {
      // Nome explícito (o default seria `product_category_content_section`):
      // diz o que a linha é — uma seção **com** categorias.
      table: "content_section_category",
      idPrefix: "csc",
      extraColumns: {
        // A ordem mora numa coluna, não dentro de um JSON.
        position: { type: "integer", defaultValue: "0" },
      },
    },
  }
)
