"use client"

import { enriquecimentoDoProduto } from "@lib/util/product-enrichment"
import {
  secoesDaPeca,
  type SecaoDaPeca,
} from "@lib/util/product-sections"
import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"
import { HttpTypes } from "@medusajs/types"

import Accordion from "./accordion"

/**
 * As seções da página da peça — descrição, ficha, cuidados, guia e aviso.
 * -------------------------------------------------------------------------
 * O componente ficou com o que é só dele: **escolher a marcação de cada seção**.
 * O que existe, em que ordem e de que tipo é `secoesDaPeca`, em `@lib/util`, que
 * é função pura e tem teste — inclusive o teste que garante que campo vazio
 * **não vira travessão**: peça sem peso e sem dimensões não desenha "Peso -".
 *
 * Era o defeito desta tela: um bloco fixo de dois acordeões com cinco "-"
 * esperando a cliente e os rótulos em inglês ("Product Information", "Type",
 * "Weight", "Dimensions") numa loja pt-BR. O texto de entrega, que é copy fixa da
 * loja, também estava em inglês: agora é pt-BR e continua aqui, porque não é dado
 * de produto — é a promessa da loja, e promessa não vem do catálogo.
 */
type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  // O produto da Store API é estruturalmente compatível com o que as duas funções
  // leem — e é o `tsc` que confirma isso, sem `as` nenhum aqui.
  const secoes = secoesDaPeca(product, enriquecimentoDoProduto(product))

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {secoes.map((secao) => (
          <Accordion.Item
            key={secao.titulo}
            title={secao.titulo}
            headingSize="medium"
            value={secao.titulo}
          >
            <div className="text-small-regular py-8">
              <Conteudo secao={secao} />
            </div>
          </Accordion.Item>
        ))}

        <Accordion.Item
          title="Entrega e trocas"
          headingSize="medium"
          value="Entrega e trocas"
        >
          <div className="text-small-regular py-8">
            <EntregaETrocas />
          </div>
        </Accordion.Item>
      </Accordion>
    </div>
  )
}

/** A marcação de cada tipo de seção. O `kind` vem decidido do util. */
const Conteudo = ({ secao }: { secao: SecaoDaPeca }) => {
  switch (secao.kind) {
    case "texto":
      return (
        <p className="max-w-prose whitespace-pre-line">{secao.texto}</p>
      )

    case "ficha":
      return (
        <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8">
          {secao.itens.map((item) => (
            <div key={item.rotulo} className="flex gap-x-2">
              <dt className="font-semibold">{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
        </dl>
      )

    case "link":
      return (
        <a
          className="underline underline-offset-4"
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
      // O realce é do componente porque é o **tipo** que o util decidiu; a
      // paleta fica no Tailwind, junto do resto da loja.
      return (
        <div className="max-w-prose rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
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

const EntregaETrocas = () => {
  return (
    <div className="grid grid-cols-1 gap-y-8">
      <div className="flex items-start gap-x-2">
        <FastDelivery />
        <div>
          <span className="font-semibold">Entrega rápida</span>
          <p className="max-w-sm">
            Sua peça chega em 3 a 5 dias úteis, no endereço que você escolher ou
            para retirada na loja.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-x-2">
        <Refresh />
        <div>
          <span className="font-semibold">Trocas simples</span>
          <p className="max-w-sm">
            Não serviu? Sem problema — a gente troca por outro tamanho ou por
            outra peça.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-x-2">
        <Back />
        <div>
          <span className="font-semibold">Devoluções fáceis</span>
          <p className="max-w-sm">
            Se não for o que você esperava, devolva e a gente devolve o valor
            pago, sem burocracia.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
