"use client"

import { Plus } from "@medusajs/icons"

import { enriquecimentoDoProduto } from "@lib/catalog/product-enrichment"
import {
  secoesDaPeca,
  type SecaoDaPeca,
} from "@lib/catalog/product-sections"
import { HttpTypes } from "@medusajs/types"

/**
 * As seções da página da peça (RV-030: o bloco fixo de entrega saiu; a seção
 * vem de `metadata.shipping_returns`).
 * -------------------------------------------------------------------------
 * O componente ficou com o que é só dele: **escolher a marcação de cada seção**.
 * O que existe, em que ordem e de que tipo é `secoesDaPeca`, em
 * `@lib/catalog/product-sections` (função pura, com teste): é ele que garante
 * que campo vazio **não vira travessão** — peça sem peso não desenha "Peso -".
 *
 * **O acordeão virou `<details>`**, como o resto da loja (`.rv-accordion`, a
 * mesma classe dos filtros do catálogo): o `<details>` nativo abre no teclado, é
 * anunciado como "expandido/recolhido" pelo leitor de tela e abre até com o
 * navegador procurando texto dentro dele — sem uma linha de JavaScript. O que
 * sai com ele é o `"use client"` deste arquivo: o componente inteiro voltou a ser
 * de servidor, e a página deixou de carregar uma ilha só para abrir e fechar
 * caixas.
 */
type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  // O produto da Store API é estruturalmente compatível com o que as duas funções
  // leem — e é o `tsc` que confirma isso, sem `as` nenhum aqui.
  const secoes = secoesDaPeca(product, enriquecimentoDoProduto(product))

  return (
    <div className="rv-accordion rv-product-accordions" data-testid="product-tabs">
      {secoes.map((secao) => (
        <details key={secao.titulo}>
          <summary>
            {secao.titulo}
            <Plus
              aria-hidden="true"
              focusable="false"
              className="rv-accordion-icon"
            />
          </summary>
          <div className="rv-accordion-body">
            <Conteudo secao={secao} />
          </div>
        </details>
      ))}
    </div>
  )
}

/** A marcação de cada tipo de seção. O `kind` vem decidido do util. */
const Conteudo = ({ secao }: { secao: SecaoDaPeca }) => {
  switch (secao.kind) {
    case "texto":
      return <p className="whitespace-pre-line">{secao.texto}</p>

    case "ficha":
      return (
        <dl>
          {secao.itens.map((item) => (
            <div key={item.rotulo} className="flex gap-x-2">
              <dt>{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
        </dl>
      )

    case "link":
      return (
        <a
          href={secao.url}
          target="_blank"
          // `noopener`: o guia abre em outra aba e não pode mexer nesta página.
          rel="noopener noreferrer"
        >
          {secao.rotulo}
        </a>
      )

    case "aviso":
      // Âmbar, e não vermelho: contraindicação é atenção, não erro do sistema.
      // O realce é do componente porque é o **tipo** que o util decidiu.
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
          {secao.texto}
        </div>
      )

    default: {
      // Exaustividade: um `kind` novo no util sem ramo aqui reprova o `tsc`
      // nesta linha, em vez de virar seção em branco na loja.
      const naoTratado: never = secao

      return naoTratado
    }
  }
}

export default ProductTabs

