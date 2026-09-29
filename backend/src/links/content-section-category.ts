import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import ContentModule from "../modules/content"

/**
 * Os chips de filtro de uma seção da vitrine (o campo `filters` do `featured`).
 * -------------------------------------------------------------------------
 * Mesma distinção da curadoria de produtos (`content-section-product.ts`), e a
 * mesma resposta:
 *
 *   seção → catálogo   **referência** (quais categorias viram chip, em que ordem);
 *   seção → texto      **cópia** (`data`: `title`, `eyebrow`, `viewAllLabel`…).
 *
 * O chip era a segunda escrita como a primeira — uma lista de rótulos dentro do
 * `data` (`["Todos", "Blazers", "Conjuntos", "Calças"]`) que a loja mandava como
 * busca textual (`q=Blazers`). Medido no banco real: das quatro, "Blazers" não
 * existe no catálogo, então aquele chip devolvia zero peças **em silêncio**, e
 * renomear uma categoria no painel não mudava o chip — a cópia era o dado.
 *
 * **Por que o link, e não um id dentro do `data`.** O nome do chip é leitura ao
 * vivo (`product_category.name`), a ordem é uma coluna de verdade, e o ciclo de
 * vida das duas pontas fica ligado: apagar a categoria pelo painel limpa o link
 * pelo workflow do Medusa (`removeRemoteLinkStep`), como apagar um produto limpa
 * a curadoria. Um id solto no JSON não teria quem o limpasse.
 *
 * **O que este link não guarda: o chip "Todos".** Ele não é categoria, é o gesto
 * de limpar o filtro, e quem o desenha é a loja. Antes, a **posição** dizia qual
 * dos chips limpava (`filters[0]`), então reordenar os chips trocava o
 * significado de cada um sem nada acusar — a mesma classe de defeito do
 * `title` que era coluna e conteúdo ao mesmo tempo (`payload.ts`).
 *
 * **`isList: true` nos dois lados.** Sem ele o próprio `remoteLink.create`
 * recusa o segundo vínculo ("Cannot create multiple links between…"): uma seção
 * tem vários chips, e a mesma categoria pode ser chip de mais de uma seção. A
 * única unicidade que sobra é a chave primária, o par
 * `(product_category_id, content_section_id)`.
 *
 * `position` é a coluna extra do link, o análogo do `content_section.position`:
 * a ordem é **dos chips**, e não do catálogo (a mesma categoria pode ser o
 * primeiro chip de uma seção e o terceiro de outra). O `remoteLink.create` é um
 * upsert — é assim que a reordenação entra, sem tabela nossa (ver
 * `writeFilters`, em `modules/content/filters.ts`).
 *
 * A tabela gerada **não** tem chave estrangeira (conferido em
 * `content_section_product`, a tabela do link irmão: nenhum `references`), e o
 * Medusa não cria: a integridade é de aplicação — `resolveCategoryIds`, na rota
 * admin, recusa id inexistente antes de gravar. É o mesmo trade-off descrito
 * por extenso em `content-section-product.ts`.
 */
export default defineLink(
  // O lado do catálogo primeiro: `defineLink` compõe o nome da entidade com os
  // dois lados na ordem declarada (`product_category` + `content_section`), e é
  // esse nome que o `query.graph` usa (`FILTERS_ENTITY`, em
  // `modules/content/filters.ts`). Trocar a ordem mudaria o nome, e a leitura
  // passaria a devolver vazio sem nenhum erro — por isso o teste de unidade
  // prende os dois (o arquivo e a constante).
  { linkable: ProductModule.linkable.productCategory, isList: true },
  { linkable: ContentModule.linkable.contentSection, isList: true },
  {
    database: {
      // O default do Medusa seria `product_category_content_section`
      // (composto dos dois módulos), e o nome escolhido diz o que a linha é —
      // uma seção **com** categorias —, como o `content_section_product`.
      table: "content_section_category",
      idPrefix: "csc",
      extraColumns: {
        // A mesma palavra da curadoria e da seção: a ordem é uma só em todo o
        // CMS, e ela mora numa coluna, não dentro de um JSON.
        position: { type: "integer", defaultValue: "0" },
      },
    },
  }
)
